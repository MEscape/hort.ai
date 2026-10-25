import { createActionInputParser } from '@lib/actions';

import { PROGRESSION_ERROR_CODES } from '../../application/contracts/progression-constraints';

export const parseProgressionInput = createActionInputParser(
  PROGRESSION_ERROR_CODES.validationFailed,
);
