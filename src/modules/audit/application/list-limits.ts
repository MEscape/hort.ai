import type { PageLimits } from '@lib/pagination';

import type { AuditPeriod } from '../domain/models/audit-filter';

/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
/** A page names at most two people per entry (who acted, whom it concerns): 100 names, one name lookup. */
export const AUDIT_PAGE_LIMITS: PageLimits = { defaultPageSize: 25, maxPageSize: 50 };

/** More event types than every module declares together; the facet list never grows past it. */
export const MAX_AUDIT_TYPES = 200;

/** The members offered as a filter: the people who appear in a tenant's trail, named in one lookup. */
export const MAX_AUDIT_MEMBERS = 100;

/** Entries the overview lists, and the days its chart covers (the audit page's period of the same length). */
export const AUDIT_DIGEST_RECENT = 5;
export const AUDIT_DIGEST_DAYS = 30;
export const AUDIT_DIGEST_PERIOD: AuditPeriod = '30d';
