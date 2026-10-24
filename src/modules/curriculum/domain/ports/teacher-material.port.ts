import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TeacherMaterialStatement } from '../models/competency';

/**
 * Teacher material that may ground a child (#29). The caller passes the class the CHILD belongs to;
 * an implementation returns only sections of material uploaded for exactly that class (and not
 * deleted), so material never reaches a child of another class. Until #29 ships, the adapter
 * returns nothing.
 */
export interface TeacherMaterialSource {
  listForClassroom(
    classroomId: string,
    limit: number,
  ): AppResultAsync<readonly TeacherMaterialStatement[], InfrastructureAppError>;
}
