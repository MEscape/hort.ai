import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { parseAssignmentId } from '../../domain/models/ids';

import type { Assignment } from '../../domain/models/assignment';
import type { AssignmentsDependencies } from '../assignments-dependencies';

/** Teacher-only internal read. A missing or foreign-owned id produces the same null result. */
export class GetAssignmentById {
  constructor(private readonly deps: AssignmentsDependencies) {}

  execute(
    rawId: string,
  ): AppResultAsync<
    Assignment | null,
    AuthorizationError | ValidationAppError | InfrastructureAppError
  > {
    return this.deps.authorization
      .requireInTenant('assignment.read')
      .andThen((actor) =>
        parseAssignmentId(rawId).asyncAndThen((id) =>
          this.deps.assignments.findById(id, { tenantId: actor.tenantId, ownerId: actor.id }),
        ),
      );
  }
}
