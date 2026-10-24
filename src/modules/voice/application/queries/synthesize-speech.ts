import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  VOICE_VALIDATION_CODES,
  fromRateLimitFailure,
  invalidVoiceInput,
  unknownSpeaker,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { SynthesizeSpeechInput } from '../contracts/voice-inputs';
import type { SpeechAudioView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type SynthesizeSpeechError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Speaks checked text in a speaker's voice. Nothing is stored: the audio goes back to the caller.
 * The text comes from a request, so it is never trusted: unless it is one of the speaker's fixed
 * lines (the owl's), it must pass the guidance module's content and child-safety rules, and
 * rejected text is never sent to the provider. The speaker and the text are checked before the
 * budget is spent, the budget before the provider is called.
 */
export class SynthesizeSpeech {
  constructor(private readonly deps: VoiceDependencies) {}

  execute(input: SynthesizeSpeechInput): AppResultAsync<SpeechAudioView, SynthesizeSpeechError> {
    return this.deps.authorization
      .requireInTenant('voice.use')
      .andThen((actor) => {
        const { speech } = this.deps;
        if (speech === null) {
          return errAsync(voiceDisabled());
        }
        const speakerId = parseSpeakerId(input.speakerId);
        if (speakerId.isErr()) {
          return errAsync(speakerId.error);
        }
        const voiceId = this.deps.voices.voiceFor(speakerId.value);
        if (voiceId === null) {
          return errAsync(unknownSpeaker());
        }
        return speakableText(input.text)
          .andThen((text) =>
            this.deps.voices.isFixedLine(speakerId.value, text) || this.deps.textGuard.isSafe(text)
              ? ok(text)
              : err(invalidVoiceInput('text', VOICE_VALIDATION_CODES.textUnsafe)),
          )
          .asyncAndThen((text) =>
            this.deps.rateLimiter
              .enforce({
                policy: VOICE_RATE_LIMITS.synthesize,
                subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
              })
              .mapErr(fromRateLimitFailure)
              .andThen(() => okAsync(text)),
          )
          .andThen((text) => speech.synthesize({ text, voiceId }));
      })
      .map((spoken) => ({ audio: spoken.audio, contentType: spoken.contentType }));
  }
}
