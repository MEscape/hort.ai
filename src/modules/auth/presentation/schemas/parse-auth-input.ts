import { createActionInputParser } from '@lib/actions';

import { AUTH_ERROR_CODES } from '../../application/contracts/auth-constraints';

export const parseAuthInput = createActionInputParser(AUTH_ERROR_CODES.validationFailed);
