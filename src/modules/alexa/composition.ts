import 'server-only';

import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';

import { verifyAlexaRequest } from './infrastructure/ask-sdk/ask-request-verifier';
import { connectionTestTutor } from './infrastructure/connection-test/connection-test-tutor';
import { catalogTutorIntroductions } from './infrastructure/tutors/catalog-tutor-introductions';
import { voiceModuleTutorVoice } from './infrastructure/voice/voice-module-tutor-voice';
import { createAlexaEndpoint } from './presentation/routes';

const log = logger.withContext({ module: 'alexa' });

/**
 * Alexa is a voice channel onto hort.ai's tutor. `tutor` is the only seam: replace the connection-test stub
 * with an adapter onto the tutor module's public API (see alexa/README.md); verification stays as it is.
 * `voice` speaks tutor replies in the tutor's ElevenLabs voice (voice module); any failure keeps Alexa's.
 * `introductions`: on launch every ready tutor greets in catalog order, each in its own voice.
 * ALEXA_TUTOR_ID only picks the voice of tutor replies, not who introduces itself.
 */
export const handleAlexaRequest = createAlexaEndpoint({
  skillId: serverEnv.ALEXA_SKILL_ID,
  verify: verifyAlexaRequest,
  tutor: connectionTestTutor,
  introductions: catalogTutorIntroductions(),
  voice: serverEnv.ALEXA_TUTOR_VOICE ? voiceModuleTutorVoice(serverEnv.ALEXA_TUTOR_ID) : null,
  onVoiceFallback: (reason) => {
    log.warn('Alexa tutor voice unavailable; standard voice used', { reason });
  },
});
