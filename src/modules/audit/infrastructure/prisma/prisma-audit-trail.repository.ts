import { createPersistenceFailures, dateToInstant, db, toJsonValue } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { offsetOf, toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isDefined, literalGuard } from '@lib/utils';

import { AUDIT_ERROR_CODES } from '../../domain/errors/audit-errors';
import { AUDIT_SOURCES } from '../../domain/models/audit-entry';
import { toActorId } from '../../domain/models/ids';

import {
  ACTOR_KIND_RECORD,
  AUDIT_ENTRY_SELECT,
  SEVERITY_RECORD,
  toAuditEntry,
} from './audit-trail-record-mapper';

import type { AuditActor, AuditEntry, NewAuditEntry } from '../../domain/models/audit-entry';
import type { AuditScope } from '../../domain/models/audit-scope';
import type { ActorId, TenantId } from '../../domain/models/ids';
import type {
  AuditDayCount,
  AuditCriteria,
  AuditTrailRepository,
  AuditTypeCount,
} from '../../domain/ports/audit-trail.repository';

const failures = createPersistenceFailures({
  module: 'audit.persistence',
  code: AUDIT_ERROR_CODES.persistenceFailed,
  subject: 'AuditEntry',
});

const isSource = literalGuard(AUDIT_SOURCES);

/** The equality part of a filter on the actor. */
function actorWhere(actor: AuditActor | null) {
  if (actor === null) {
    return {};
  }
  return actor.kind === 'member'
    ? { actorKind: ACTOR_KIND_RECORD.member, actorId: actor.id }
    : { actorKind: ACTOR_KIND_RECORD[actor.kind] };
}

/** What a scope adds to a query: its tenant, or nothing for the platform's. */
function inScope(scope: AuditScope): { tenantId?: TenantId } {
  return scope.kind === 'tenant' ? { tenantId: scope.tenantId } : {};
}

/**
 * The entries of the scope that match the criteria; every part maps onto an index's leading columns.
 *
 * @owner-scope platform The platform scope reads every tenant and can only be named, never defaulted to: `AuditScope` has no absent value, and a tenant scope pins `tenantId`.
 */
function matching(
  scope: AuditScope,
  criteria: Omit<AuditCriteria, 'source' | 'type'> &
    Partial<Pick<AuditCriteria, 'source' | 'type'>>,
) {
  const equal = db.orm.public.AuditEntry.where({
    ...inScope(scope),
    ...(criteria.source === undefined || criteria.source === null
      ? {}
      : { source: criteria.source }),
    ...(criteria.type === undefined || criteria.type === null ? {} : { type: criteria.type }),
    ...(criteria.onlyWarnings ? { severity: SEVERITY_RECORD.warn } : {}),
    ...actorWhere(criteria.actor),
  });
  const { since } = criteria;
  return since === null
    ? equal
    : equal.where((entry) => entry.occurredAt.gte(dateToInstant(since)));
}

/**
 * Prisma-backed trail, the only place that touches `db` for it. Every read
 * is scoped to one tenant or the platform and bounded; failures are
 * infrastructure only and logged once, here.
 */
export class PrismaAuditTrailRepository implements AuditTrailRepository {
  append(entry: NewAuditEntry): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.AuditEntry.select('id').create({
          tenantId: entry.tenantId,
          source: entry.source,
          type: entry.type,
          severity: SEVERITY_RECORD[entry.severity],
          actorKind: ACTOR_KIND_RECORD[entry.actor.kind],
          actorId: entry.actor.kind === 'member' ? entry.actor.id : null,
          details: toJsonValue(entry.details),
          occurredAt: dateToInstant(entry.occurredAt),
        }),
      failures.infraOnly('append'),
    ).map(() => undefined);
  }

  list(
    scope: AuditScope,
    criteria: AuditCriteria,
    page: PageRequest,
  ): AppResultAsync<Page<AuditEntry>, InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      const total = await matching(scope, criteria).aggregate((aggregate) => ({
        total: aggregate.count(),
      }));
      const records = await matching(scope, criteria)
        .select(...AUDIT_ENTRY_SELECT)
        // `id` breaks ties so the order is stable between requests.
        .orderBy([(entry) => entry.occurredAt.desc(), (entry) => entry.id.desc()])
        .limit(page.pageSize)
        .offset(offsetOf(page))
        .all();
      return { records, total: total.total };
    }, failures.infraOnly('list')).map(({ records, total }) =>
      toPage(records.map(toAuditEntry).filter(isDefined), total, page),
    );
  }

  countByType(
    scope: AuditScope,
    criteria: Omit<AuditCriteria, 'source' | 'type'>,
    limit: number,
  ): AppResultAsync<readonly AuditTypeCount[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        matching(scope, criteria)
          .groupBy('source', 'type')
          .orderBy([(entry) => entry.source.asc(), (entry) => entry.type.asc()])
          .limit(limit)
          .aggregate((aggregate) => ({ count: aggregate.count() })),
      failures.infraOnly('countByType'),
    ).map((rows) =>
      rows.flatMap(({ source, type, count }) =>
        isSource(source) ? [{ source, type, count }] : [],
      ),
    );
  }

  /** @owner-scope platform The scope names the tenant, or the platform's own: see `matching`. */
  listMemberIds(
    scope: AuditScope,
    limit: number,
  ): AppResultAsync<
    { readonly items: readonly ActorId[]; readonly isTruncated: boolean },
    InfrastructureAppError
  > {
    return fromThrowableAsync(
      async () =>
        db.orm.public.AuditEntry.where({
          ...inScope(scope),
          actorKind: ACTOR_KIND_RECORD.member,
        })
          .groupBy('actorId')
          .orderBy((entry) => entry.actorId.asc())
          .limit(limit + 1)
          .aggregate((aggregate) => ({ count: aggregate.count() })),
      failures.infraOnly('listMemberIds'),
    ).map((rows) => ({
      items: rows
        .slice(0, limit)
        .flatMap(({ actorId }) => (actorId === null ? [] : [toActorId(actorId)])),
      isTruncated: rows.length > limit,
    }));
  }

  countPerDay(
    tenantId: TenantId,
    since: Date,
  ): AppResultAsync<readonly AuditDayCount[], InfrastructureAppError> {
    return fromThrowableAsync(async () => {
      // Grouping by a computed day is beyond the ORM's groupBy; the plan stays parameterized and index-served.
      const perDay = db.raw.sql`
        SELECT to_char("occurredAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
               count(*)::int AS total,
               count(*) FILTER (WHERE "severity" = ${SEVERITY_RECORD.warn})::int AS warnings
        FROM "AuditEntry"
        WHERE "tenantId" = ${tenantId} AND "occurredAt" >= ${since.toISOString()}::timestamptz
        GROUP BY 1
        ORDER BY 1`
        .returnsRow({
          day: { codecId: 'pg/text@1', nullable: false },
          total: { codecId: 'pg/int4@1', nullable: false },
          warnings: { codecId: 'pg/int4@1', nullable: false },
        })
        .build();
      return db.runtime().query(perDay);
    }, failures.infraOnly('countPerDay'));
  }

  /** @owner-scope platform Retention is a job of the platform: it removes old entries of every tenant. */
  deleteOlderThan(cutoff: Date): AppResultAsync<number, InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        db.orm.public.AuditEntry.where((entry) =>
          entry.occurredAt.lt(dateToInstant(cutoff)),
        ).deleteAndCount(),
      failures.infraOnly('deleteOlderThan'),
    );
  }
}
