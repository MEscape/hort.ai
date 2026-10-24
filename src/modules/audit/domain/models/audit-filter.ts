import { MS_PER_DAY } from '@lib/utils';

import type { AuditActorKind, AuditSource } from './audit-entry';

/** How far back the trail is read. Relative to now, so a shared address keeps meaning "the last week". */
export const AUDIT_PERIODS = ['24h', '7d', '30d', '90d', 'all'] as const;
export type AuditPeriod = (typeof AUDIT_PERIODS)[number];

export const DEFAULT_AUDIT_PERIOD: AuditPeriod = '30d';

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_QUARTER = 90;

const PERIOD_MS = {
  '24h': MS_PER_DAY,
  '7d': DAYS_PER_WEEK * MS_PER_DAY,
  '30d': DAYS_PER_MONTH * MS_PER_DAY,
  '90d': DAYS_PER_QUARTER * MS_PER_DAY,
  all: null,
} as const satisfies Record<AuditPeriod, number | null>;

/** Whose entries a reader wants: one member by the id the address carries (unchecked), all visitors, or the system. */
export type AuditActorFilter =
  | { readonly kind: Extract<AuditActorKind, 'member'>; readonly id: string }
  | { readonly kind: Exclude<AuditActorKind, 'member'> };

/** What a reader narrows the trail to. Every part is optional except the period, which has a default. */
export interface AuditFilter {
  /** Only this tenant's entries, for the platform-wide trail; a tenant's own trail ignores it. Unchecked: the query parses it. */
  readonly tenantId: string | null;
  readonly source: AuditSource | null;
  readonly type: string | null;
  readonly actor: AuditActorFilter | null;
  readonly period: AuditPeriod;
  readonly onlyWarnings: boolean;
}

export const EMPTY_AUDIT_FILTER: AuditFilter = {
  tenantId: null,
  source: null,
  type: null,
  actor: null,
  period: DEFAULT_AUDIT_PERIOD,
  onlyWarnings: false,
};

/** The first instant the period covers, or `null` for the whole trail. */
export function sinceOf(period: AuditPeriod, now: Date): Date | null {
  const milliseconds = PERIOD_MS[period];
  return milliseconds === null ? null : new Date(now.getTime() - milliseconds);
}
