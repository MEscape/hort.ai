import { createActionInputParser } from '@lib/actions';

import { CLASSROOM_ERROR_CODES } from '../../application/contracts/classroom-constraints';

export const parseClassroomInput = createActionInputParser(CLASSROOM_ERROR_CODES.validationFailed);
