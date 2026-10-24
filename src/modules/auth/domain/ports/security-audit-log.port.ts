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
    };

/**
 * Append-only security trail. `record` is synchronous and MUST NOT throw or
 * block: auditing can never be the reason a request fails or slows down.
 * The adapter writes a structured log line and, through the audit module, a durable trail entry.
 */
export interface SecurityAuditLog {
  record(event: SecurityEvent): void;
}
