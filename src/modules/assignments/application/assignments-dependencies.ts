import type { AuthorizationService } from '@modules/auth';

import type { Clock } from '@lib/clock';

import type { AssignmentAuditLog } from '../domain/ports/assignment-audit-log.port';
import type { AssignmentRepository } from '../domain/ports/assignment.repository';
import type { ClassroomAccess } from '../domain/ports/classroom-access.port';

export interface AssignmentsDependencies {
  readonly authorization: AuthorizationService;
  readonly assignments: AssignmentRepository;
  readonly classrooms: ClassroomAccess;
  readonly audit: AssignmentAuditLog;
  readonly clock: Clock;
}
