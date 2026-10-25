import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import type { TeacherMaterialStatement } from '../../domain/models/competency';
import type { ClassroomId, ChildProfileId } from '../../domain/models/ids';
import type { TeacherMaterialSource } from '../../domain/ports/teacher-material.port';

interface Dependencies {
  readonly childClassroom: {
    execute(id: string): AppResultAsync<{ readonly classroomId: string } | null>;
  };
  readonly list: (
    classroomId: ClassroomId,
    limit: number,
    childProfileId: ChildProfileId,
  ) => AppResultAsync<readonly TeacherMaterialStatement[]>;
}

/** Authorizes the parent's child through #32; a client-supplied class alone never confers access. */
export class ClassroomTeacherMaterialSource implements TeacherMaterialSource {
  constructor(private readonly deps: Dependencies) {}
  listForClassroom: TeacherMaterialSource['listForClassroom'] = (
    classroomId,
    limit,
    childProfileId,
  ) => {
    if (!childProfileId) {
      return okAsync([]);
    }
    return this.deps.childClassroom
      .execute(childProfileId)
      .andThen((room) =>
        room?.classroomId === classroomId
          ? this.deps.list(classroomId, limit, childProfileId)
          : okAsync([]),
      )
      .orElse((error) => (error.kind === 'infrastructure' ? errAsync(error) : okAsync([])));
  };
}
