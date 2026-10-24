import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { loadClampedPage, resolvePageRequest } from '@lib/pagination';
import { ResultAsync, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { sinceOf } from '../../domain/models/audit-filter';
import { parseActorId } from '../../domain/models/ids';
import { toAuditEntryView } from '../audit-view-mappers';
import { AUDIT_PAGE_LIMITS, MAX_AUDIT_MEMBERS, MAX_AUDIT_TYPES } from '../list-limits';

import type { AuditActor } from '../../domain/models/audit-entry';
import type { AuditActorFilter, AuditFilter } from '../../domain/models/audit-filter';
import type { AuditScope } from '../../domain/models/audit-scope';
import type { AuditDependencies } from '../audit-dependencies';
import type { AuditPageOptions, AuditTrailView } from '../contracts/audit-views';

/** A member's id comes from the address, so it is checked like any other id. */
function actorOf(
  filter: AuditActorFilter | null,
): AppResult<AuditActor | null, ValidationAppError> {
  if (filter?.kind !== 'member') {
    return ok(filter);
  }
  return parseActorId(filter.id).map((id) => ({ kind: 'member', id }));
}

/**
 * One page of the trail within `scope` under a filter, newest first, with the counts per event
 * type and the members the filter can offer. The three reads are independent and run together.
 * Shared by the use cases that name their scope: one tenant, or every tenant.
 */
export function readAuditTrail(
  deps: AuditDependencies,
  request: {
    readonly scope: AppResult<AuditScope, ValidationAppError>;
    readonly filter: AuditFilter;
    readonly options: AuditPageOptions;
  },
): AppResultAsync<AuditTrailView, ValidationAppError | InfrastructureAppError> {
  const { scope, filter, options } = request;
  const { entries, clock } = deps;
  const requested = resolvePageRequest(options, AUDIT_PAGE_LIMITS);
  const readAt = clock.now();
  const since = sinceOf(filter.period, readAt);

  return scope
    .andThen((resolved) => actorOf(filter.actor).map((actor) => ({ scope: resolved, actor })))
    .asyncAndThen(({ scope: resolved, actor }) => {
      const shared = { actor, since, onlyWarnings: filter.onlyWarnings };
      return ResultAsync.combine([
        loadClampedPage(requested, (pageRequest) =>
          entries.list(
            resolved,
            { ...shared, source: filter.source, type: filter.type },
            pageRequest,
          ),
        ),
        entries.countByType(resolved, shared, MAX_AUDIT_TYPES),
        entries.listMemberIds(resolved, MAX_AUDIT_MEMBERS),
      ] as const).map(([page, types, members]) => ({
        entries: { ...page, items: page.items.map(toAuditEntryView) },
        types,
        memberIds: members.items,
        isMembersTruncated: members.isTruncated,
        readAt,
      }));
    });
}
