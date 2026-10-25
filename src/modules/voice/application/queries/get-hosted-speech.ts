import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync, ResultAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  VOICE_VALIDATION_CODES,
  fromRateLimitFailure,
  invalidVoiceInput,
  speechHostingDisabled,
  unknownPhrase,
  unknownSpeaker,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';
import { spendSpeechCharacters } from '../services/speech-budget';

import type { SpeakerId } from '../../domain/models/ids';
import type { ClipContent, HostedClip } from '../../domain/ports/speech-clips.port';
import type { HostedSpeechInput, HostedSpeechSource } from '../contracts/voice-inputs';
import type { HostedSpeechView } from '../contracts/voice-views';
import type { HostedSpeechDependencies } from '../voice-dependencies';

export type GetHostedSpeechError =
  ValidationAppError | NotFoundAppError | RateLimitedAppError | InfrastructureAppError;

/**
 * Speech behind a short-lived URL, for channels that play audio from a link (Alexa). Equal text in
 * an equal voice is synthesized once and then served from storage, so a fixed sentence costs the
 * provider nothing after the first time; only a synthesis spends the global budgets (the hosted
 * one and the daily character budget).
 *
 * @authorization system Called by server-side channel adapters that authenticate their caller
 * themselves (Alexa: Amazon's request signature). There is no actor, so there is no ticket and no
 * consent to check: the words must be a fixed line of the tutor catalog or a fixed channel sentence
 * of `channel-lines.json`. Free text (a child's words, a generated answer) is refused.
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
    const text = this.wordsOf(input.source, speakerId.value).andThen(speakableText);
    if (text.isErr()) {
      return errAsync(text.error);
    }
    const content: ClipContent = { voice: voiceId, text: text.value };
    return this.sharedClip(content, () =>
      clips.find(content).andThen((stored) =>
        stored !== null
          ? okAsync(stored)
          : this.deps.rateLimiter
              .enforce({ policy: VOICE_RATE_LIMITS.hostedSynthesize, subject: { kind: 'global' } })
              .mapErr(fromRateLimitFailure)
              .andThen(() => spendSpeechCharacters(this.deps.rateLimiter, content.text))
              .andThen(() => speech.synthesize({ voiceId, text: content.text }))
              .andThen((spoken) => clips.save(content, spoken.audio, spoken.contentType)),
      ),
    ).map((clip) => ({ url: clip.url, expiresAt: clip.expiresAt }));
  }

  /** The words to say: only fixed, reviewed lines; never text from the caller as such. */
  private wordsOf(
    source: HostedSpeechSource,
    speakerId: SpeakerId,
  ): AppResult<string, NotFoundAppError | ValidationAppError> {
    if (source.kind === 'phrase') {
      const line = this.deps.phrases.phraseFor(speakerId, source.phrase);
      return line === null ? err(unknownPhrase()) : ok(line);
    }
    return this.deps.channelLines.isChannelLine(source.text)
      ? ok(source.text)
      : err(invalidVoiceInput('text', VOICE_VALIDATION_CODES.freeTextRefused));
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
