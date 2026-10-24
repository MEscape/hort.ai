import { createActionInputParser } from '@lib/actions';

import { LEARNER_ERROR_CODES } from '../../application/contracts/learner-constraints';

export const parseLearnerInput = createActionInputParser(LEARNER_ERROR_CODES.validationFailed);
