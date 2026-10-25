import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { messageNotFound, voiceConsentRequired } from '../../domain/errors/voice-errors';
import { parseChildProfileId, toSpeakerId } from '../../domain/models/ids';
import { speakableText } from '../../domain/models/utterance';

import type { ChildCompanion } from '../../domain/ports/companion-messages.port';
import type { IssueReadAloudTicketInput } from '../contracts/voice-inputs';
import type { ReadAloudTicketView } from '../contracts/voice-views';
import type { IssueReadAloudTicketDependencies } from '../voice-dependencies';

/** The app's own voice (the owl), for a child that has not chosen a companion yet. */
const NARRATOR = toSpeakerId('eule');

/**
 * Lets the child hear one message of their companion in the companion's voice (#34). The browser
 * names the message (a hint of the open help session, the comprehension question, a fixed
 * feedback line), never its words: those are read on the server from the stored, validated session
 * or the translated catalog, for the signed-in parent's own child only and only while the parent
 * allows speech for that child (fail closed). The ticket is redeemed by `SynthesizeSpeech`, which
 * spends the parent's speech budget; issuing it costs nothing.
 */
export class IssueReadAloudTicket {
  constructor(private readonly deps: IssueReadAloudTicketDependencies) {}

  execute(input: IssueReadAloudTicketInput): AppResultAsync<ReadAloudTicketView> {
    return this.deps.authorization.requireInTenant('voice.use').andThen((actor) =>
      parseChildProfileId(input.childProfileId).asyncAndThen((childProfileId) =>
        this.deps.messages.companionOf(childProfileId).andThen((companion) => {
          if (!companion.voiceConsent) {
            return errAsync(voiceConsentRequired());
          }
          return this.deps.messages
            .textOf(childProfileId, input.message, input.wording)
            .andThen((text) => (text === null ? errAsync(messageNotFound()) : okAsync(text)))
            .andThen(speakableText)
            .map((text) => ({
              ticket: this.deps.tickets.issue(text, {
                tenantId: actor.tenantId,
                actorId: actor.id,
              }),
              speakerId: this.speakerOf(companion),
            }));
        }),
      ),
    );
  }

  /** The child's companion when it has a voice, otherwise the narrator. */
  private speakerOf(companion: ChildCompanion): string {
    const tutor = companion.tutorId === null ? null : toSpeakerId(companion.tutorId);
    return tutor !== null && this.deps.voices.voiceFor(tutor) !== null ? tutor : NARRATOR;
  }
}
