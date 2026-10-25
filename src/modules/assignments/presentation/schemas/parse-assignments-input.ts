import { createActionInputParser } from '@lib/actions';

import { ASSIGNMENTS_ERROR_CODES } from '../../application/contracts/assignment-constraints';

export const parseAssignmentsInput = createActionInputParser(
  ASSIGNMENTS_ERROR_CODES.validationFailed,
);
