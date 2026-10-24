import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { MS_PER_DAY } from '@lib/utils';

import { tenantAuditScope } from '../../domain/models/audit-scope';
import { parseTenantId } from '../../domain/models/ids';
import { toAuditEntryView } from '../audit-view-mappers';
import { AUDIT_DIGEST_DAYS, AUDIT_DIGEST_PERIOD, AUDIT_DIGEST_RECENT } from '../list-limits';

import type { AuditDayCount } from '../../domain/ports/audit-trail.repository';
import type { AuditDependencies } from '../audit-dependencies';
import type { AuditDayView, AuditDigestView } from '../contracts/audit-views';

const ISO_DAY_LENGTH = 10;

/**
 * Every UTC day from the first one on, with its counts or zero: a chart of
 * activity needs the quiet days too. Shortcut: days are UTC days, so an entry
 * just after local midnight can fall on the day before; switch to the
 * tenant's time zone when a tenant has one.
 */
function everyDay(first: Date, counted: readonly AuditDayCount[]): readonly AuditDayView[] {
  const byDay = new Map(counted.map((count) => [count.day, count]));
  return Array.from({ length: AUDIT_DIGEST_DAYS }, (_, index) => {
    const day = new Date(first.getTime() + index * MS_PER_DAY)
      .toISOString()
      .slice(0, ISO_DAY_LENGTH);
    const count = byDay.get(day);
    return { day, total: count?.total ?? 0, warnings: count?.warnings ?? 0 };
  });
}

/**
 * The newest entries of a tenant's trail and its entries and warnings per
 * day over the last month: what the overview shows of it.
 *
 * @authorization system Called by the module that serves the overview, which authorizes `audit.read` on the tenant and passes the id of the tenant it loaded.
 */
export class GetAuditDigest {
  constructor(private readonly deps: AuditDependencies) {}

  execute(
    rawTenantId: string,
  ): AppResultAsync<AuditDigestView, ValidationAppError | InfrastructureAppError> {
    const { entries, clock } = this.deps;
    const now = clock.now();
    // Midnight UTC of the first day shown, so the first bar is a whole day.
    const first = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (AUDIT_DIGEST_DAYS - 1)),
    );

    return parseTenantId(rawTenantId).asyncAndThen((tenantId) =>
      ResultAsync.combine([
        entries.list(
          tenantAuditScope(tenantId),
          { source: null, type: null, actor: null, since: null, onlyWarnings: false },
          { page: 1, pageSize: AUDIT_DIGEST_RECENT },
        ),
        entries.countPerDay(tenantId, first),
      ] as const).map(([recent, counted]) => {
        const days = everyDay(first, counted);
        return {
          recent: recent.items.map(toAuditEntryView),
          days,
          total: days.reduce((sum, day) => sum + day.total, 0),
          warnings: days.reduce((sum, day) => sum + day.warnings, 0),
          period: AUDIT_DIGEST_PERIOD,
        };
      }),
    );
  }
}
