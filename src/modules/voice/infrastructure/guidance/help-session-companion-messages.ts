import type { HelpSessionView } from '@modules/guidance';

import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { childProfileNotFound } from '../../domain/errors/voice-errors';

import type { CompanionMessageRef, PredefinedWording } from '../../domain/models/companion-message';
import type { ChildProfileId } from '../../domain/models/ids';
import type { ChildCompanion, CompanionMessages } from '../../domain/ports/companion-messages.port';

type GetChildProfile = (id: string) => AppResultAsync<ChildCompanion>;
type GetOpenHelpSession = (childProfileId: string) => AppResultAsync<HelpSessionView | null>;
type SessionMessage = Exclude<CompanionMessageRef, { kind: 'feedback' }>;

/** The stored words of a hint or the open question, or the catalog key of their predefined text. */
function wordsIn(
  session: HelpSessionView | null,
  message: SessionMessage,
  wording: PredefinedWording,
): string | null {
  if (message.kind === 'hint') {
    const hint = session?.hints[message.index];
    if (hint === undefined) {
      return null;
    }
    return hint.kind === 'generated' ? hint.text : wording(`hint.fallback.${hint.level}`);
  }
  const question = session?.openQuestion ?? null;
  if (question === null) {
    return null;
  }
  return question.kind === 'generated'
    ? question.text
    : wording('feedback.fallback.comprehension_question');
}

/**
 * Reads the companion's messages from the guidance module's public help-session query, which
 * authorizes the parent and checks the child is theirs, and the child's companion and voice
 * consent from the learner module. A validated AI text is spoken as stored; a predefined text is
 * spoken in the exact wording the child sees, from the guidance catalog. A foreign or missing
 * child profile becomes `voice.child_profile_not_found`, so ids cannot be probed.
 */
export function helpSessionCompanionMessages(options: {
  readonly getChildProfile: GetChildProfile;
  readonly getOpenHelpSession: GetOpenHelpSession;
}): CompanionMessages {
  return {
    companionOf: (childProfileId: ChildProfileId) =>
      options
        .getChildProfile(childProfileId)
        .map((profile) => ({ voiceConsent: profile.voiceConsent, tutorId: profile.tutorId }))
        .mapErr((error) =>
          error.kind === 'forbidden' || error.kind === 'not_found' ? childProfileNotFound() : error,
        ),
    textOf: (childProfileId, message, wording) => {
      if (message.kind !== 'feedback') {
        return options
          .getOpenHelpSession(childProfileId)
          .map((session) => wordsIn(session, message, wording));
      }
      return okAsync(
        wording(
          message.feedback === 'praise'
            ? 'feedback.fallback.praise'
            : `feedback.fallback.answer_assessment.${message.feedback}`,
        ),
      );
    },
  };
}
