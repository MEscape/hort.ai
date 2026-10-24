import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError, RateLimitedAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { fromRateLimitFailure, voiceDisabled } from '../../domain/errors/voice-errors';
import { SPEECH_LIMITS } from '../../domain/models/speech-limits';
import { transcribableRecording } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { TranscribeSpeechInput } from '../contracts/voice-inputs';
import type { TranscriptView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type TranscribeSpeechError =
  AuthorizationError | ValidationAppError | RateLimitedAppError | InfrastructureAppError;

/**
 * Turns a child's German recording into text. The recording is sent once and never stored; the
 * text is only a suggestion the child corrects before sending it like typed text.
 */
export class TranscribeSpeech {
  constructor(private readonly deps: VoiceDependencies) {}

  execute(input: TranscribeSpeechInput): AppResultAsync<TranscriptView, TranscribeSpeechError> {
    return this.deps.authorization
      .requireInTenant('voice.use')
      .andThen((actor) => {
        const { speech } = this.deps;
        if (speech === null) {
          return errAsync(voiceDisabled());
        }
        return transcribableRecording(input)
          .asyncAndThen((recording) =>
            this.deps.rateLimiter
              .enforce({
                policy: VOICE_RATE_LIMITS.transcribe,
                subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
              })
              .mapErr(fromRateLimitFailure)
              .andThen(() => okAsync(recording)),
          )
          .andThen((recording) =>
            speech.transcribe({
              audio: recording.audio,
              contentType: recording.contentType,
              languageCode: SPEECH_LIMITS.languageCode,
            }),
          );
      })
      .map((transcript) => ({ text: transcript.text }));
  }
}
