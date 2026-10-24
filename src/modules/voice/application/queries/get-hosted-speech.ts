import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  fromRateLimitFailure,
  speechHostingDisabled,
  unknownSpeaker,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { ClipContent } from '../../domain/ports/speech-clips.port';
import type { SynthesizeSpeechInput } from '../contracts/voice-inputs';
import type { HostedSpeechView } from '../contracts/voice-views';
import type { HostedSpeechDependencies } from '../voice-dependencies';

export type GetHostedSpeechError =
  ValidationAppError | NotFoundAppError | RateLimitedAppError | InfrastructureAppError;

/**
 * Speech behind a short-lived URL, for channels that play audio from a link (Alexa). Equal text in
 * an equal voice is synthesized once and then served from storage, so a fixed sentence costs the
 * provider nothing after the first time; only a synthesis spends the global budget.
 *
 * @authorization system Called by server-side channel adapters that authenticate their caller
 * themselves (Alexa: Amazon's request signature). There is no actor; the text comes from trusted
 * server code, never from a public request.
 */
export class GetHostedSpeech {
  constructor(private readonly deps: HostedSpeechDependencies) {}

  execute(input: SynthesizeSpeechInput): AppResultAsync<HostedSpeechView, GetHostedSpeechError> {
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
    const text = speakableText(input.text);
    if (text.isErr()) {
      return errAsync(text.error);
    }
    const content: ClipContent = { voice: voiceId, text: text.value };
    return clips
      .find(content)
      .andThen((stored) =>
        stored !== null
          ? okAsync(stored)
          : this.deps.rateLimiter
              .enforce({ policy: VOICE_RATE_LIMITS.hostedSynthesize, subject: { kind: 'global' } })
              .mapErr(fromRateLimitFailure)
              .andThen(() => speech.synthesize({ voiceId, text: content.text }))
              .andThen((spoken) => clips.save(content, spoken.audio, spoken.contentType)),
      )
      .map((clip) => ({ url: clip.url, expiresAt: clip.expiresAt }));
  }
}
