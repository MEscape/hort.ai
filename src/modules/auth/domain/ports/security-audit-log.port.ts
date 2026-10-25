import type { DenialReason } from '../models/authorize';
import type { ActorId, TenantId } from '../models/ids';
import type { Permission } from '../models/permission';

/**
 * Security-relevant facts worth keeping. Every variant is free of secrets:
 * no emails, tokens, passwords or reset links, only stable identifiers and
 * error codes. Every variant names its tenant, which places it in the audit trail. Adding a variant forces the
 * sink's severity table and the trail policy to be updated (both are `satisfies Record<SecurityEvent['type'], ...>`).
 */
export type SecurityEvent =
  | {
      readonly type: 'authorization.denied';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly permission: Permission;
      readonly reason: DenialReason;
    }
  | {
      /** A platform admin was let into a resource of another parent (`ownerId`). */
      readonly type: 'authorization.admin_override';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly permission: Permission;
      readonly ownerId: ActorId;
    }
  | {
      readonly type: 'authentication.sign_in_failed';
      readonly tenantId: TenantId;
      readonly errorCode: string;
    }
  | {
      readonly type: 'authentication.session_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
    }
  | {
      readonly type: 'authentication.session_revoked';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
    }
  | {
      readonly type: 'authentication.account_created';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
    }
  | {
      readonly type: 'authentication.password_reset_completed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
    }
  | {
      /** The signed-in parent re-entered their password and opened the parent area. */
      readonly type: 'authentication.parent_area_opened';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
    }
  | {
      /** A wrong password at the parent gate, e.g. someone else on the shared device guessing. */
      readonly type: 'authentication.parent_area_open_failed';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly errorCode: string;
    };

/**
 * Append-only security trail. `record` is synchronous and MUST NOT throw or
 * block: auditing can never be the reason a request fails or slows down.
 * The adapter writes a structured log line and, through the audit module, a durable trail entry.
 */
export interface SecurityAuditLog {
  record(event: SecurityEvent): void;
}
