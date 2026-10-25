import { createActionInputParser } from '@lib/actions';

import { LESSON_ERROR_CODES } from '../../application/contracts/lesson-constraints';

export const parseLessonInput = createActionInputParser(LESSON_ERROR_CODES.validationFailed);
