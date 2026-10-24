import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { tenantAuditScope } from '../../domain/models/audit-scope';
import { parseTenantId } from '../../domain/models/ids';
import { readAuditTrail } from '../services/read-audit-trail';

import type { AuditFilter } from '../../domain/models/audit-filter';
import type { AuditDependencies } from '../audit-dependencies';
import type { AuditPageOptions, AuditTrailView } from '../contracts/audit-views';

/**
 * One page of ONE tenant's trail under a filter, newest first, with the counts per event type and
 * the members the filter can offer. The id comes from the address, so it is checked like any
 * other; a missing one is an error here, never every tenant (that is `GetAllTenantsAuditTrail`).
 *
 * @authorization system Called by the module that serves the screen, which authorizes `audit.read` on the tenant and passes the id of the tenant it loaded.
 */
export class GetAuditTrail {
  constructor(private readonly deps: AuditDependencies) {}

  execute(
    rawTenantId: string,
    filter: AuditFilter,
    options: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, ValidationAppError | InfrastructureAppError> {
    return readAuditTrail(this.deps, {
      scope: parseTenantId(rawTenantId).map(tenantAuditScope),
      filter,
      options,
    });
  }
}
