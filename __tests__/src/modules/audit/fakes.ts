import type { AuditEntry, NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import type { AuditScope } from '@modules/audit/domain/models/audit-scope';
import { toActorId, toTenantId } from '@modules/audit/domain/models/ids';
import type {
  AuditCriteria,
  AuditDayCount,
  AuditTrailRepository,
  AuditTypeCount,
} from '@modules/audit/domain/ports/audit-trail.repository';

import type { InfrastructureAppError } from '@lib/errors';
import { infrastructureError } from '@lib/errors';
import { toPage } from '@lib/pagination';
import type { Page, PageRequest } from '@lib/pagination';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

export const NOW = new Date('2026-06-15T10:30:00.000Z');
export const clock = { now: () => NOW };

export const TENANT = toTenantId('default');

export function entry(overrides: Partial<NewAuditEntry> = {}): NewAuditEntry {
  return {
    tenantId: TENANT,
    source: 'auth',
    type: 'authentication.session_created',
    severity: 'info',
    actor: { kind: 'member', id: toActorId('parent-1') },
    details: {},
    occurredAt: NOW,
    ...overrides,
  };
}

export function stored(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return { id: 'entry-1', ...entry(), ...overrides };
}

export const STORE_DOWN: InfrastructureAppError = infrastructureError(
  'audit.persistence_failed',
  'The audit trail could not be written.',
);

export interface RepositoryCalls {
  readonly appended: NewAuditEntry[];
  readonly listed: Array<{
    readonly scope: AuditScope;
    readonly criteria: AuditCriteria;
    readonly page: PageRequest;
  }>;
  readonly counted: Array<{ readonly scope: AuditScope; readonly limit: number }>;
  readonly memberLookups: Array<{ readonly scope: AuditScope; readonly limit: number }>;
  readonly perDay: Array<{ readonly tenantId: string; readonly since: Date }>;
  readonly deletedBefore: Date[];
}

export interface FakeRepositoryOptions {
  readonly failWith?: InfrastructureAppError;
  readonly total?: number;
  readonly items?: readonly AuditEntry[];
  readonly types?: readonly AuditTypeCount[];
  readonly memberIds?: readonly string[];
  readonly isMembersTruncated?: boolean;
  readonly days?: readonly AuditDayCount[];
  readonly deleted?: number;
}

/** Answers canned data and remembers every question, so a test asserts on what was asked and returned. */
export function fakeRepository(
  options: FakeRepositoryOptions = {},
): AuditTrailRepository & { readonly calls: RepositoryCalls } {
  const calls: RepositoryCalls = {
    appended: [],
    listed: [],
    counted: [],
    memberLookups: [],
    perDay: [],
    deletedBefore: [],
  };
  const answer = <T>(value: T): AppResultAsync<T, InfrastructureAppError> =>
    options.failWith === undefined ? okAsync(value) : errAsync(options.failWith);

  return {
    calls,
    append: (newEntry) => {
      calls.appended.push(newEntry);
      return answer(undefined);
    },
    list: (scope, criteria, page): AppResultAsync<Page<AuditEntry>, InfrastructureAppError> => {
      calls.listed.push({ scope, criteria, page });
      const items = options.items ?? [];
      return answer(toPage(items, options.total ?? items.length, page));
    },
    countByType: (scope, _criteria, limit) => {
      calls.counted.push({ scope, limit });
      return answer(options.types ?? []);
    },
    listMemberIds: (scope, limit) => {
      calls.memberLookups.push({ scope, limit });
      return answer({
        items: (options.memberIds ?? []).map(toActorId),
        isTruncated: options.isMembersTruncated ?? false,
      });
    },
    countPerDay: (tenantId, since) => {
      calls.perDay.push({ tenantId, since });
      return answer(options.days ?? []);
    },
    deleteOlderThan: (cutoff) => {
      calls.deletedBefore.push(cutoff);
      return answer(options.deleted ?? 0);
    },
  };
}
