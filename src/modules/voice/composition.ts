import 'server-only';

import { randomBytes } from 'node:crypto';

import { getAccessControl } from '@modules/auth';
import { getHelpSessionQueries } from '@modules/guidance';
import { getLearnerQueries } from '@modules/learner';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { getRateLimiter } from '@lib/rate-limit';
import { getSpeechProvider } from '@lib/speech/server';
import { getObjectStore } from '@lib/storage/server';
import { once } from '@lib/utils';

import { GetHostedSpeech } from './application/queries/get-hosted-speech';
import { IssueReadAloudTicket } from './application/queries/issue-read-aloud-ticket';
import { IssueSpeechTicket } from './application/queries/issue-speech-ticket';
import { SynthesizeSpeech } from './application/queries/synthesize-speech';
import { TranscribeSpeech } from './application/queries/transcribe-speech';
import { catalogChannelLines } from './infrastructure/catalog/catalog-channel-lines';
import { catalogSpeakerVoices } from './infrastructure/catalog/catalog-speaker-voices';
import { catalogSystemPhrases } from './infrastructure/catalog/catalog-system-phrases';
import { helpSessionCompanionMessages } from './infrastructure/guidance/help-session-companion-messages';
import { learnerChildVoiceConsent } from './infrastructure/learner/learner-child-voice-consent';
import { cachedCompanionSpeech } from './infrastructure/storage/cached-companion-speech';
import { objectStoreSpeechClips } from './infrastructure/storage/object-store-speech-clips';
import { hmacSpokenTextTickets } from './infrastructure/tickets/hmac-spoken-text-tickets';
import { createVoiceRouteHandlers } from './presentation/http/voice-route-handlers';

import type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';

const log = logger.withContext({ module: 'voice' });
/** Size of the per-process key used when no `AUTH_SECRET` is set. */
const TICKET_KEY_BYTES = 32;

/** One ticket signer for every use case, so a ticket issued by one redeems in another. */
const speechTickets = once(() =>
  hmacSpokenTextTickets({ secret: ticketSecret(), clock: systemClock }),
);

/**
 * The module's composition root. Built on first use, so a build that imports a voice route needs
 * no speech configuration; without `ELEVENLABS_API_KEY` the use cases answer `voice.disabled`.
 */
export const getVoiceQueries = once(() => {
  const authorization = getAccessControl();
  const provider = getSpeechProvider();
  const store = getObjectStore();
  const speech =
    provider !== null && store?.supports('private') === true
      ? cachedCompanionSpeech(provider, objectStoreSpeechClips(store, { clock: systemClock }))
      : provider;
  const dependencies = {
    authorization,
    rateLimiter: getRateLimiter(),
    speech,
    voices: catalogSpeakerVoices(),
    phrases: catalogSystemPhrases(),
    tickets: speechTickets(),
    consent: learnerChildVoiceConsent((id) => getLearnerQueries().getChildProfileById.execute(id)),
  };
  return {
    synthesizeSpeech: new SynthesizeSpeech(dependencies),
    transcribeSpeech: new TranscribeSpeech(dependencies),
    issueSpeechTicket: new IssueSpeechTicket(dependencies),
    issueReadAloudTicket: new IssueReadAloudTicket({
      authorization,
      tickets: dependencies.tickets,
      voices: dependencies.voices,
      messages: helpSessionCompanionMessages({
        getChildProfile: (id) => getLearnerQueries().getChildProfileById.execute(id),
        getOpenHelpSession: (childProfileId) =>
          getHelpSessionQueries().getOpenHelpSession.execute({ childProfileId }),
      }),
    }),
  } as const;
});

/**
 * Speech behind a short-lived URL for server-side channels (Alexa): fixed lines, and read-aloud
 * tickets redeemed by a channel acting for a child. Without `ELEVENLABS_API_KEY` or a private storage
 * container it answers `voice.disabled` / `voice.hosting_disabled`, and the channel keeps its own voice.
 */
export const getHostedSpeech = once(() => {
  const store = getObjectStore();
  return new GetHostedSpeech({
    authorization: getAccessControl(),
    tickets: speechTickets(),
    rateLimiter: getRateLimiter(),
    speech: getSpeechProvider(),
    voices: catalogSpeakerVoices(),
    phrases: catalogSystemPhrases(),
    channelLines: catalogChannelLines(),
    clips:
      store?.supports('private') === true
        ? objectStoreSpeechClips(store, { clock: systemClock })
        : null,
  });
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
