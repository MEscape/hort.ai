import { createActionInputParser } from '@lib/actions';

import { TEACHER_MATERIAL_ERROR_CODES } from '../../application/contracts/teacher-material-constraints';

export const parseTeacherMaterialInput = createActionInputParser(
  TEACHER_MATERIAL_ERROR_CODES.validationFailed,
);
