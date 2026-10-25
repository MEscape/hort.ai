import { createActionInputParser } from '@lib/actions';

import { VOICE_ERROR_CODES } from '../../application/contracts/voice-constraints';

export const parseVoiceInput = createActionInputParser(VOICE_ERROR_CODES.validationFailed);
