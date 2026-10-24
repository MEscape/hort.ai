import type { AppResultAsync } from '@lib/result';

import { toClassroomView } from '../classroom-view-mappers';
import { loadAuthorizedClassroom } from '../load-authorized-classroom';

import type { ClassroomDependencies } from '../classroom-dependencies';
import type { ClassroomView } from '../contracts/classroom-views';
import type { LoadClassroomError } from '../load-authorized-classroom';

/**
 * Reads one of the signed-in teacher's own classes; another teacher's is refused. Also the check
 * material (#29) and assignments (#33) use before they attach anything to a class.
 */
export class GetClassroomById {
  constructor(private readonly deps: ClassroomDependencies) {}

  execute(id: string): AppResultAsync<ClassroomView, LoadClassroomError> {
    return loadAuthorizedClassroom(this.deps, id, 'classroom.read').map(({ classroom }) =>
      toClassroomView(classroom),
    );
  }
}
