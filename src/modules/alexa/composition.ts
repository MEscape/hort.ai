import 'server-only';

import { serverEnv } from '@lib/config/server';

import { verifyAlexaRequest } from './infrastructure/ask-sdk/ask-request-verifier';
import { connectionTestTutor } from './infrastructure/connection-test/connection-test-tutor';
import { createAlexaEndpoint } from './presentation/routes';

/**
 * Alexa is a voice channel onto hort.ai's tutor. `tutor` is the only seam: replace the connection-test stub
 * with an adapter onto the tutor module's public API (see alexa/README.md); verification stays as it is.
 */
export const handleAlexaRequest = createAlexaEndpoint({
  skillId: serverEnv.ALEXA_SKILL_ID,
  verify: verifyAlexaRequest,
  tutor: connectionTestTutor,
});
