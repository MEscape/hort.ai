import type { AuthorizationService } from '@modules/auth';

import type { AssignmentRepository } from '../domain/ports/assignment.repository';

export interface AssignmentsDependencies {
  readonly authorization: AuthorizationService;
  readonly assignments: Pick<AssignmentRepository, 'findById'>;
}
