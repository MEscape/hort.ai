import { okAsync } from '@lib/result';

import type { TeacherMaterialSource } from '../../domain/ports/teacher-material.port';

/**
 * Stand-in until teacher uploads (#29) exist: no class has material yet. #29 replaces it with an
 * adapter that reads `MaterialSection` rows of PROCESSED material of exactly the given class.
 */
export const noTeacherMaterialSource: TeacherMaterialSource = {
  listForClassroom: () => okAsync([]),
};
