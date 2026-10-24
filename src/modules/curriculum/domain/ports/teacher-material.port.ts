import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TeacherMaterialStatement } from '../models/competency';
import type { ChildProfileId, ClassroomId } from '../models/ids';

/**
 * Teacher material that may ground a child (#29). The caller passes the class the CHILD belongs to;
 * an implementation returns only sections of material uploaded for exactly that class (and not
 * deleted), so material never reaches a child of another class. Private material requires a child
 * context: the adapter re-authorizes that child and verifies its current active membership. A class
 * id without childProfileId never grants access.
 */
export interface TeacherMaterialSource {
  listForClassroom(
    classroomId: ClassroomId,
    limit: number,
    childProfileId?: ChildProfileId,
  ): AppResultAsync<readonly TeacherMaterialStatement[], InfrastructureAppError>;
}
