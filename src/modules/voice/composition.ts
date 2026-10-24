import 'server-only';

import { randomBytes } from 'node:crypto';

import { getAccessControl } from '@modules/auth';
import { learnerQueries } from '@modules/learner';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { getRateLimiter } from '@lib/rate-limit';
import { getSpeechProvider } from '@lib/speech/server';
import { once } from '@lib/utils';

import { IssueSpeechTicket } from './application/queries/issue-speech-ticket';
import { SynthesizeSpeech } from './application/queries/synthesize-speech';
import { TranscribeSpeech } from './application/queries/transcribe-speech';
import { catalogSpeakerVoices } from './infrastructure/catalog/catalog-speaker-voices';
import { catalogSystemPhrases } from './infrastructure/catalog/catalog-system-phrases';
import { learnerChildVoiceConsent } from './infrastructure/learner/learner-child-voice-consent';
import { hmacSpokenTextTickets } from './infrastructure/tickets/hmac-spoken-text-tickets';
import { createVoiceRouteHandlers } from './presentation/http/voice-route-handlers';

import type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';

const log = logger.withContext({ module: 'voice' });
/** Size of the per-process key used when no `AUTH_SECRET` is set. */
const TICKET_KEY_BYTES = 32;

/**
 * The module's composition root. Built on first use, so a build that imports a voice route needs
 * no speech configuration; without `ELEVENLABS_API_KEY` the use cases answer `voice.disabled`.
 */
export const getVoiceQueries = once(() => {
  const authorization = getAccessControl();
  const dependencies = {
    authorization,
    rateLimiter: getRateLimiter(),
    speech: getSpeechProvider(),
    voices: catalogSpeakerVoices(),
    phrases: catalogSystemPhrases(),
    tickets: hmacSpokenTextTickets({ secret: ticketSecret(), clock: systemClock }),
    consent: learnerChildVoiceConsent((id) => learnerQueries.getChildProfileById.execute(id)),
  };
  return {
    synthesizeSpeech: new SynthesizeSpeech(dependencies),
    transcribeSpeech: new TranscribeSpeech(dependencies),
    issueSpeechTicket: new IssueSpeechTicket(dependencies),
  } as const;
});

/**
 * Speech tickets are signed with a key derived from `AUTH_SECRET`, which every deployment with
 * sign-in already has. Without it (auth switched off in development) a random per-process key is
 * used: tickets then only work on the instance that issued them, which is all local work needs.
 */
function ticketSecret(): string {
  const secret = serverEnv.AUTH_SECRET;
  return secret !== undefined && secret !== ''
    ? secret
    : randomBytes(TICKET_KEY_BYTES).toString('hex');
}

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
