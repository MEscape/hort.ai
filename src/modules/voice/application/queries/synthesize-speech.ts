import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  ForbiddenAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import {
  fromRateLimitFailure,
  invalidVoiceInput,
  unknownPhrase,
  unknownSpeaker,
  VOICE_VALIDATION_CODES,
  voiceDisabled,
  voiceConsentRequired,
} from '../../domain/errors/voice-errors';
import { parseChildProfileId, parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';

import type { SpeakerId } from '../../domain/models/ids';
import type { TicketHolder } from '../../domain/ports/spoken-text-tickets.port';
import type { SpeechSource, SynthesizeSpeechInput } from '../contracts/voice-inputs';
import type { SpeechAudioView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type SynthesizeSpeechError =
  | AuthorizationError
  | ForbiddenAppError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Speaks validated text in a speaker's voice. The words never come from the request: they are a
 * fixed line of the tutor catalog or the text of a ticket the server issued for a hint the guidance
 * orchestrator validated (`IssueSpeechTicket`). Nothing is stored: the audio goes back to the
 * caller. The speaker and the text are checked before the budget is spent, the budget before the
 * provider is called.
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
        const holder: TicketHolder = {
          tenantId: actor.tenantId,
          actorId: actor.id,
          speakerId: input.speakerId,
          ...(input.childProfileId === undefined ? {} : { childProfileId: input.childProfileId }),
        };
        return this.wordsOf(input.source, speakerId.value, holder)
          .andThen(speakableText)
          .asyncAndThen((text) => {
            const consent =
              input.childProfileId === undefined
                ? okAsync(true)
                : parseChildProfileId(input.childProfileId).asyncAndThen((id) =>
                    this.deps.consent.voiceConsentOf(id),
                  );
            return consent.andThen((allowed) =>
              allowed ? okAsync(text) : errAsync(voiceConsentRequired()),
            );
          })
          .andThen((text) =>
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

  /** The words to say, from trusted configuration or a ticket only this parent can redeem. */
  private wordsOf(
    source: SpeechSource,
    speakerId: SpeakerId,
    holder: TicketHolder,
  ): AppResult<string, NotFoundAppError | ValidationAppError> {
    if (source.kind === 'phrase') {
      const line = this.deps.phrases.phraseFor(speakerId, source.phrase);
      return line === null ? err(unknownPhrase()) : ok(line);
    }
    const text = this.deps.tickets.redeem(source.ticket, holder);
    return text === null
      ? err(invalidVoiceInput('ticket', VOICE_VALIDATION_CODES.ticketInvalid))
      : ok(text);
  }
}
