import type { AuthorizationError } from '@modules/auth';

import type {
  ForbiddenAppError,
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  fromRateLimitFailure,
  voiceConsentRequired,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseChildProfileId } from '../../domain/models/ids';
import { SPEECH_LIMITS } from '../../domain/models/speech-limits';
import { transcribableRecording } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { TranscribeSpeechInput } from '../contracts/voice-inputs';
import type { TranscriptView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type TranscribeSpeechError =
  | AuthorizationError
  | ForbiddenAppError
  | NotFoundAppError
  | ValidationAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Turns a child's German recording into text. Sending the recording to the provider takes it out of
 * the session, so it happens only for the signed-in parent's own child and only while that child's
 * profile has `voiceConsent` (set and withdrawn by the parent on the profile, `UpdateChildProfile`
 * in the learner module); otherwise `voice.consent_required` and the interface stays with text.
 * The recording is sent once and never stored. The transcript is only returned, as a suggestion
 * the child corrects; nothing is sent on, and the sent text goes through the same input validation
 * as typed text (`parseChildTaskText`, guidance module, #11) wherever it is submitted.
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
        return parseChildProfileId(input.childProfileId)
          .asyncAndThen((childProfileId) => this.deps.consent.voiceConsentOf(childProfileId))
          .andThen((consented) => (consented ? okAsync(input) : errAsync(voiceConsentRequired())))
          .andThen((consented) => transcribableRecording(consented))
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
