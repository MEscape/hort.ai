import type { AuthorizationError } from '@modules/auth';

import type {
  ForbiddenAppError,
  InfrastructureAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  consentRequired,
  fromRateLimitFailure,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { SPEECH_LIMITS } from '../../domain/models/speech-limits';
import { transcribableRecording } from '../../domain/models/utterance';
import { isConsentGiven } from '../../domain/models/voice-consent';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { TranscribeSpeechInput } from '../contracts/voice-inputs';
import type { TranscriptView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type TranscribeSpeechError =
  | AuthorizationError
  | ForbiddenAppError
  | ValidationAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Turns a child's German recording into text. The `voice.use` permission is not consent: the
 * signed-in parent must have explicitly allowed speech input and not revoked it. That is checked
 * before anything else, fail-closed (no record, a revoked one or an unreadable store all refuse), so
 * no recording reaches the provider without it. The recording is sent once and never stored; the
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
        return this.deps.consents
          .find({ tenantId: actor.tenantId, parentId: actor.id })
          .andThen((consent) =>
            isConsentGiven(consent) ? okAsync(undefined) : errAsync(consentRequired()),
          )
          .andThen(() => transcribableRecording(input))
          .andThen((recording) =>
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
