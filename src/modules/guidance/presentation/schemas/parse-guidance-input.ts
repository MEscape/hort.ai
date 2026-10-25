import { createActionInputParser } from '@lib/actions';

import { GUIDANCE_ERROR_CODES } from '../../application/contracts/guidance-constraints';

export const parseGuidanceInput = createActionInputParser(GUIDANCE_ERROR_CODES.validationFailed);
