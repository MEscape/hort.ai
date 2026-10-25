import type { AuthorizationError } from '@modules/auth';

import type {
  InfrastructureAppError,
  NotFoundAppError,
  RateLimitedAppError,
  ValidationAppError,
} from '@lib/errors';
import { err, errAsync, ok, okAsync } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';
import type { SpeechProvider } from '@lib/speech';

import {
  fromRateLimitFailure,
  invalidVoiceInput,
  unknownPhrase,
  unknownSpeaker,
  VOICE_VALIDATION_CODES,
  voiceDisabled,
} from '../../domain/errors/voice-errors';
import { parseSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';
import { VOICE_RATE_LIMITS } from '../rate-limits';
import { spendSpeechCharacters } from '../services/speech-budget';

import type { SpeakerId } from '../../domain/models/ids';
import type { ClipContent, StoredAudio } from '../../domain/ports/speech-clips.port';
import type { TicketHolder } from '../../domain/ports/spoken-text-tickets.port';
import type { SpeechSource, SynthesizeSpeechInput } from '../contracts/voice-inputs';
import type { SpeechAudioView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

export type SynthesizeSpeechError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | RateLimitedAppError
  | InfrastructureAppError;

/**
 * Speaks validated text in a speaker's voice. The words never come from the request: they are a
 * fixed line of the tutor catalog or the text of a ticket the server issued for a hint the guidance
 * orchestrator validated (`IssueSpeechTicket`). Equal text in an equal voice is synthesized once and
 * then read from the clip store (keyed by a hash of voice and text), so a replayed ticket or a
 * repeated catalog line costs the provider nothing. The speaker and the text are checked before the
 * parent's budget is spent, that budget before the clip lookup, and only a real synthesis spends the
 * global daily character budget.
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
        const holder = { tenantId: actor.tenantId, actorId: actor.id };
        return this.wordsOf(input.source, speakerId.value, holder)
          .andThen(speakableText)
          .asyncAndThen((text) =>
            this.deps.rateLimiter
              .enforce({
                policy: VOICE_RATE_LIMITS.synthesize,
                subject: { kind: 'actor', tenantId: actor.tenantId, actorId: actor.id },
              })
              .mapErr(fromRateLimitFailure)
              .andThen(() => okAsync(text)),
          )
          .andThen((text) => this.spoken(speech, { voice: voiceId, text }));
      })
      .map((spoken) => ({ audio: spoken.audio, contentType: spoken.contentType }));
  }

  /**
   * The stored clip of equal content, else a synthesis that spends the global character budget
   * and is stored for next time. The clip store is only a cache: when it cannot be read or written
   * the words are still spoken, and the budgets still cap the cost.
   */
  private spoken(
    speech: SpeechProvider,
    content: ClipContent,
  ): AppResultAsync<StoredAudio, RateLimitedAppError | InfrastructureAppError> {
    const { clips, rateLimiter } = this.deps;
    const stored =
      clips === null ? okAsync(null) : clips.findAudio(content).orElse(() => okAsync(null));
    return stored.andThen((found) =>
      found !== null
        ? okAsync(found)
        : spendSpeechCharacters(rateLimiter, content.text)
            .andThen(() => speech.synthesize({ text: content.text, voiceId: content.voice }))
            .andThen((synthesized) =>
              clips === null
                ? okAsync(synthesized)
                : clips
                    .save(content, synthesized.audio, synthesized.contentType)
                    .map(() => synthesized)
                    .orElse(() => okAsync(synthesized)),
            ),
    );
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
