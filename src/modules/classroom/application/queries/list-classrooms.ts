import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import {
  DEFAULT_CLASSROOM_LIST_LIMIT,
  MAX_CLASSROOM_LIST_LIMIT,
  MIN_CLASSROOM_LIST_LIMIT,
} from '../classroom-limits';
import { toClassroomView } from '../classroom-view-mappers';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomView } from '../contracts/classroom-views';

export interface ListClassroomsOptions {
  readonly limit?: number;
}

/** Lists the signed-in teacher's own classes, archived ones included, newest first. Bounded. */
export class ListClassrooms {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(
    options: ListClassroomsOptions = {},
  ): AppResultAsync<readonly ClassroomView[], AuthorizationError | InfrastructureAppError> {
    const requested =
      isDefined(options.limit) && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_CLASSROOM_LIST_LIMIT;
    const limit = clamp(requested, MIN_CLASSROOM_LIST_LIMIT, MAX_CLASSROOM_LIST_LIMIT);

    return this.deps.authorization
      .requireInTenant('classroom.read')
      .andThen((actor) => this.deps.classrooms.listByOwner(actor.tenantId, actor.id, limit))
      .map((classrooms) => classrooms.map(toClassroomView));
  }
}
