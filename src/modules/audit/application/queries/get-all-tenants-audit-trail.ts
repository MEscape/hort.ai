import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import { ok } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { PLATFORM_AUDIT_SCOPE, tenantAuditScope } from '../../domain/models/audit-scope';
import { parseTenantId } from '../../domain/models/ids';
import { readAuditTrail } from '../services/read-audit-trail';

import type { AuditFilter } from '../../domain/models/audit-filter';
import type { AuditDependencies } from '../audit-dependencies';
import type { AuditPageOptions, AuditTrailView } from '../contracts/audit-views';

/**
 * One page of the trail of EVERY tenant under a filter, newest first. The filter may narrow it to
 * one tenant (the platform's screen offers that); without one, it reads across tenants, which is
 * why it is a use case of its own and not a tenant id that may be absent.
 *
 * @authorization system Called by the module that serves the platform screen, which authorizes reading across all tenants (the platform's administrators) before it asks.
 */
export class GetAllTenantsAuditTrail {
  constructor(private readonly deps: AuditDependencies) {}

  execute(
    filter: AuditFilter,
    options: AuditPageOptions = {},
  ): AppResultAsync<AuditTrailView, ValidationAppError | InfrastructureAppError> {
    const scope =
      filter.tenantId === null
        ? ok(PLATFORM_AUDIT_SCOPE)
        : parseTenantId(filter.tenantId).map(tenantAuditScope);
    return readAuditTrail(this.deps, { scope, filter, options });
  }
}
