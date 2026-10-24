import type { TenantId } from './ids';

/**
 * Whose entries a read covers. The trail of every tenant is a different kind of read, not a
 * tenant that happens to be absent: with a `TenantId | null` parameter, a missing id (a lost
 * route parameter, a failed lookup) silently reads EVERY tenant's entries. A scope has to be named,
 * and the platform scope has a name no tenant id can take.
 */
export type AuditScope =
  { readonly kind: 'tenant'; readonly tenantId: TenantId } | { readonly kind: 'platform' };

export const PLATFORM_AUDIT_SCOPE: AuditScope = { kind: 'platform' };

export function tenantAuditScope(tenantId: TenantId): AuditScope {
  return { kind: 'tenant', tenantId };
}
