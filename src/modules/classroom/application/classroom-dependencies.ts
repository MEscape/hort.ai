import type { AuthorizationService } from '@modules/auth';

import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { ChildProfileAccess } from '../domain/ports/child-profile-access.port';
import type { ClassroomAuditLog } from '../domain/ports/classroom-audit-log.port';
import type { ClassroomRepository } from '../domain/ports/classroom.repository';
import type { InviteCodeIssuer } from '../domain/ports/invite-code-issuer.port';

/** What every classroom use case is built from. */
export interface ClassroomDependencies {
  readonly authorization: AuthorizationService;
  readonly classrooms: ClassroomRepository;
  readonly inviteCodes: InviteCodeIssuer;
  readonly childProfiles: ChildProfileAccess;
  readonly audit: ClassroomAuditLog;
  readonly rateLimiter: RateLimiter;
  readonly clientAddress: ClientAddressProvider;
}
