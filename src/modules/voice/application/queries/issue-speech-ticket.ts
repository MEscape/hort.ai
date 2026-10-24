import type { AuthorizationError } from '@modules/auth';
import type { HintOutcome } from '@modules/guidance';

import type { ValidationAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { speakableText } from '../../domain/models/utterance';

import type { SpeechTicketView } from '../contracts/voice-views';
import type { VoiceDependencies } from '../voice-dependencies';

/** A hint the guidance orchestrator validated against the AI output contract and the safety rules. */
export type ValidatedHint = Extract<HintOutcome, { readonly kind: 'generated' }>;

export type IssueSpeechTicketError = AuthorizationError | ValidationAppError;

/**
 * Issues the ticket that lets the signed-in parent's session have a validated hint read aloud. The
 * caller is server code that just received the hint from the orchestrator and hands the ticket to
 * the browser next to the text; `SynthesizeSpeech` then speaks the ticket's text, never words from
 * the request. Only the text of a `generated` outcome is accepted: a fallback carries no text, its
 * wording lives in the i18n catalog. The text must be speakable in one request, so a too-long hint
 * is refused here rather than at playback.
 */
export class IssueSpeechTicket {
  constructor(private readonly deps: Pick<VoiceDependencies, 'authorization' | 'tickets'>) {}

  execute(hint: ValidatedHint): AppResultAsync<SpeechTicketView, IssueSpeechTicketError> {
    return this.deps.authorization.requireInTenant('voice.use').andThen((actor) =>
      speakableText(hint.text).map((text) => ({
        ticket: this.deps.tickets.issue(text, { tenantId: actor.tenantId, actorId: actor.id }),
      })),
    );
  }
}
