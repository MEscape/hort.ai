import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';
import type { SpeechProvider } from '@lib/speech';

import type { ChannelLines } from '../domain/ports/channel-lines.port';
import type { ChildVoiceConsent } from '../domain/ports/child-voice-consent.port';
import type { CompanionMessages } from '../domain/ports/companion-messages.port';
import type { SpeakerVoices } from '../domain/ports/speaker-voices.port';
import type { SpeechClips } from '../domain/ports/speech-clips.port';
import type { SpokenTextTickets } from '../domain/ports/spoken-text-tickets.port';
import type { SystemPhrases } from '../domain/ports/system-phrases.port';

/** What every voice use case is built from. `speech` is `null` while speech is switched off. */
export interface VoiceDependencies {
  readonly authorization: AuthorizationService;
  readonly rateLimiter: RateLimiter;
  readonly speech: SpeechProvider | null;
  readonly voices: SpeakerVoices;
  readonly phrases: SystemPhrases;
  readonly tickets: SpokenTextTickets;
  readonly consent: ChildVoiceConsent;
}

/**
 * What hosted speech is built from: no authorization (it has no actor), no tickets and no consent
 * (no child's words or recordings ever reach it), only fixed lines and the clip store.
 */
export interface HostedSpeechDependencies {
  readonly rateLimiter: RateLimiter;
  readonly speech: SpeechProvider | null;
  readonly voices: SpeakerVoices;
  readonly phrases: SystemPhrases;
  readonly channelLines: ChannelLines;
  /** `null` while no private object storage is configured. */
  readonly clips: SpeechClips | null;
}

/** What reading a companion message aloud is built from: no speech provider, no store. */
export interface IssueReadAloudTicketDependencies {
  readonly authorization: AuthorizationService;
  readonly tickets: SpokenTextTickets;
  readonly voices: SpeakerVoices;
  readonly messages: CompanionMessages;
}
