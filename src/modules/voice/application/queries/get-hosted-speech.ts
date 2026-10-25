import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  VOICE_VALIDATION_CODES,
  fromRateLimitFailure,
  invalidVoiceInput,
  speechHostingDisabled,
  unknownPhrase,
  unknownSpeaker,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseChildProfileId, parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { SpeakerId } from '../../domain/models/ids';
import type { ClipContent, HostedClip } from '../../domain/ports/speech-clips.port';
import type { HostedSpeechInput, HostedSpeechSource } from '../contracts/voice-inputs';
import type { HostedSpeechView } from '../contracts/voice-views';
import type { HostedSpeechDependencies } from '../voice-dependencies';

export type GetHostedSpeechError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Speech behind a short-lived URL, for channels that play audio from a link (Alexa). Equal text in
 * an equal voice is synthesized once and then served from storage, so a fixed sentence costs the
 * provider nothing after the first time; only a synthesis spends the global budget.
 *
 * @authorization system Called by server-side channel adapters that authenticate their caller
 * themselves (Alexa: Amazon's request signature). Without an actor the words must be a fixed line of
 * the tutor catalog or a fixed channel sentence of `channel-lines.json`; free text (a child's words, a
 * generated answer) is refused. A read-aloud ticket needs `voice.use` and is redeemed only by the actor,
 * child and voice it was issued to (a channel acting for one child: its guardian's channel actor).
 *
 * Concurrent requests for the same clip share one lookup and at most one synthesis (single flight per
 * instance), so a burst of cache misses neither bills the provider nor spends the budget more than once.
 */
export class GetHostedSpeech {
  private readonly inFlight = new Map<string, AppResultAsync<HostedClip, GetHostedSpeechError>>();

  constructor(private readonly deps: HostedSpeechDependencies) {}

  execute(input: HostedSpeechInput): AppResultAsync<HostedSpeechView, GetHostedSpeechError> {
    const { speech, clips } = this.deps;
    if (speech === null) {
      return errAsync(voiceDisabled());
    }
    if (clips === null) {
      return errAsync(speechHostingDisabled());
    }
    const speakerId = parseSpeakerId(input.speakerId);
    if (speakerId.isErr()) {
      return errAsync(speakerId.error);
    }
    const voiceId = this.deps.voices.voiceFor(speakerId.value);
    if (voiceId === null) {
      return errAsync(unknownSpeaker());
    }
    return this.wordsOf(input.source, speakerId.value)
      .andThen(speakableText)
      .andThen((text) => {
        const content: ClipContent = { voice: voiceId, text };
        return this.sharedClip(content, () =>
          clips.find(content).andThen((stored) =>
            stored !== null
              ? okAsync(stored)
              : this.deps.rateLimiter
                  .enforce({
                    policy: VOICE_RATE_LIMITS.hostedSynthesize,
                    subject: { kind: 'global' },
                  })
                  .mapErr(fromRateLimitFailure)
                  .andThen(() => speech.synthesize({ voiceId, text: content.text }))
                  .andThen((spoken) => clips.save(content, spoken.audio, spoken.contentType)),
          ),
        );
      })
      .map((clip) => ({ url: clip.url, expiresAt: clip.expiresAt }));
  }

  /** The words to say: only fixed, reviewed lines or a ticket's validated text; never the caller's text. */
  private wordsOf(
    source: HostedSpeechSource,
    speakerId: SpeakerId,
  ): AppResultAsync<string, GetHostedSpeechError> {
    if (source.kind === 'phrase') {
      const line = this.deps.phrases.phraseFor(speakerId, source.phrase);
      return line === null ? errAsync(unknownPhrase()) : okAsync(line);
    }
    if (source.kind === 'ticket') {
      return this.redeem(source, speakerId);
    }
    return this.deps.channelLines.isChannelLine(source.text)
      ? okAsync(source.text)
      : errAsync(invalidVoiceInput('text', VOICE_VALIDATION_CODES.freeTextRefused));
  }

  /** A read-aloud ticket's text, for the actor, child and voice it was issued to only. */
  private redeem(
    source: Extract<HostedSpeechSource, { kind: 'ticket' }>,
    speakerId: SpeakerId,
  ): AppResultAsync<string, GetHostedSpeechError> {
    const { authorization, tickets } = this.deps;
    const refused = invalidVoiceInput('ticket', VOICE_VALIDATION_CODES.ticketInvalid);
    if (authorization === undefined || tickets === undefined) {
      return errAsync(refused);
    }
    return authorization.requireInTenant('voice.use').andThen((actor) =>
      parseChildProfileId(source.childProfileId).asyncAndThen((childProfileId) => {
        const text = tickets.redeem(source.ticket, {
          tenantId: actor.tenantId,
          actorId: actor.id,
          childProfileId,
          speakerId,
        });
        return text === null ? errAsync(refused) : okAsync(text);
      }),
    );
  }

  /** Joins a running request for the same content instead of starting a second one. */
  private sharedClip(
    content: ClipContent,
    load: () => AppResultAsync<HostedClip, GetHostedSpeechError>,
  ): AppResultAsync<HostedClip, GetHostedSpeechError> {
    const key = `${content.voice}\u0000${content.text}`;
    const running = this.inFlight.get(key);
    if (running !== undefined) {
      return running;
    }
    const shared = new ResultAsync(
      Promise.resolve(load()).finally(() => {
        this.inFlight.delete(key);
      }),
    );
    this.inFlight.set(key, shared);
    return shared;
  }
}
