import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TeacherMaterialStatement } from '../models/competency';
import type { ClassroomId } from '../models/ids';

/**
 * Teacher material that may ground a child (#29). The caller passes the class the CHILD belongs to;
 * an implementation returns only sections of material uploaded for exactly that class (and not
 * deleted), so material never reaches a child of another class. Until #29 ships, the adapter
 * returns nothing. The id is trusted input: callers must take it from the authorized child's active
 * `ClassMembership`, and the #29 adapter should re-check that membership before reading material.
 */
export interface TeacherMaterialSource {
  listForClassroom(
    classroomId: ClassroomId,
    limit: number,
  ): AppResultAsync<readonly TeacherMaterialStatement[], InfrastructureAppError>;
}
