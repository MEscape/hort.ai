import 'server-only';

import { getAccessControl } from '@modules/auth';

import { logger } from '@lib/logger';
import { getRateLimiter } from '@lib/rate-limit';
import { getSpeechProvider } from '@lib/speech/server';
import { once } from '@lib/utils';

import { SynthesizeSpeech } from './application/queries/synthesize-speech';
import { TranscribeSpeech } from './application/queries/transcribe-speech';
import { catalogSpeakerVoices } from './infrastructure/catalog/catalog-speaker-voices';
import { createVoiceRouteHandlers } from './presentation/http/voice-route-handlers';

import type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';

const log = logger.withContext({ module: 'voice' });

/**
 * The module's composition root. Built on first use, so a build that imports a voice route needs
 * no speech configuration; without `ELEVENLABS_API_KEY` the use cases answer `voice.disabled`.
 */
export const getVoiceQueries = once(() => {
  const dependencies = {
    authorization: getAccessControl(),
    rateLimiter: getRateLimiter(),
    speech: getSpeechProvider(),
    voices: catalogSpeakerVoices(),
  };
  return {
    synthesizeSpeech: new SynthesizeSpeech(dependencies),
    transcribeSpeech: new TranscribeSpeech(dependencies),
  } as const;
});

/**
 * Handlers for `app/api/voice/*`; each route passes in the use case it calls. A provider or
 * limiter failure is logged once, here.
 */
export const getVoiceRouteHandlers = once((): VoiceRouteHandlers =>
  createVoiceRouteHandlers({
    onFailure: (operation, error) => {
      if (error.kind === 'infrastructure') {
        log.warn('Speech request failed', {
          operation,
          code: error.code,
          cause: String(error.cause),
        });
      }
    },
  }),
);
