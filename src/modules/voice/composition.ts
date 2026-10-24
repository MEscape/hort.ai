import 'server-only';

import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { logger } from '@lib/logger';
import { getRateLimiter } from '@lib/rate-limit';
import { getSpeechProvider } from '@lib/speech/server';
import { once } from '@lib/utils';

import { GrantVoiceConsent } from './application/commands/grant-voice-consent';
import { RevokeVoiceConsent } from './application/commands/revoke-voice-consent';
import { GetVoiceConsent } from './application/queries/get-voice-consent';
import { SynthesizeSpeech } from './application/queries/synthesize-speech';
import { TranscribeSpeech } from './application/queries/transcribe-speech';
import { loggerVoiceAuditLog } from './infrastructure/audit/logger-voice-audit-log';
import { catalogSpeakerVoices } from './infrastructure/catalog/catalog-speaker-voices';
import { guidanceSpokenTextGuard } from './infrastructure/guidance/guidance-spoken-text-guard';
import { PrismaVoiceConsentRepository } from './infrastructure/prisma/prisma-voice-consent.repository';
import { createVoiceRouteHandlers } from './presentation/http/voice-route-handlers';

import type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';

const log = logger.withContext({ module: 'voice' });

/**
 * The module's composition root. Built on first use, so a build that imports a voice route needs
 * no speech configuration; without `ELEVENLABS_API_KEY` the use cases answer `voice.disabled`.
 */
const getVoiceUseCases = once(() => {
  const dependencies = {
    authorization: getAccessControl(),
    rateLimiter: getRateLimiter(),
    speech: getSpeechProvider(),
    voices: catalogSpeakerVoices(),
    textGuard: guidanceSpokenTextGuard,
    consents: new PrismaVoiceConsentRepository(),
    audit: loggerVoiceAuditLog,
    clock: systemClock,
  };
  return {
    queries: {
      synthesizeSpeech: new SynthesizeSpeech(dependencies),
      transcribeSpeech: new TranscribeSpeech(dependencies),
      getVoiceConsent: new GetVoiceConsent(dependencies),
    },
    commands: {
      grantVoiceConsent: new GrantVoiceConsent(dependencies),
      revokeVoiceConsent: new RevokeVoiceConsent(dependencies),
    },
  } as const;
});

export const getVoiceQueries = () => getVoiceUseCases().queries;

export const getVoiceCommands = () => getVoiceUseCases().commands;

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
