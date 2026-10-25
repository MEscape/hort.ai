import type { AuthorizationError } from '@modules/auth';

import { conflictError, validationError } from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isNonAnswer, isTaskUnderstood } from '../../domain/answer-check/answer-decision';
import { detectsChildDistress } from '../../domain/child-safety/detect-child-distress';
import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';
import { parseChildTaskText } from '../../domain/models/child-task-text';
import { isSessionUnderstood, openQuestionCheck } from '../../domain/models/help-session';
import { parseChildProfileId, parseHelpSessionId } from '../../domain/models/ids';
import { ownChildScope, refuseChildInDistress } from '../services/own-child-session';

import type { ChildProfileId, HelpSessionId } from '../../domain/models/ids';
import type { ReplyToComprehensionQuestionInput } from '../contracts/help-session-inputs';
import type { ComprehensionReplyView } from '../contracts/help-session-views';
import type { HelpSessionDependencies } from '../help-session-dependencies';

export type ReplyToComprehensionQuestionError =
  | AuthorizationError
  | ValidationAppError
  | NotFoundAppError
  | ConflictAppError
  | InfrastructureAppError;

const noOpenQuestion = () =>
  conflictError(GUIDANCE_ERROR_CODES.noOpenQuestion, 'There is no question to reply to.');

const notAnAnswer = () =>
  validationError(GUIDANCE_ERROR_CODES.replyNotAnAnswer, 'The reply says nothing yet.', {
    reply: [GUIDANCE_ERROR_CODES.replyNotAnAnswer],
  });

/**
 * The child replies to the comprehension question that followed a correct answer (#78). The reply
 * is checked like any child input, then for distress (#90) and for saying nothing ("?", "weiß
 * nicht"), which asks the child for their own words instead; it is stored once. Whether the task is now understood is decided
 * here from the stored result (`isTaskUnderstood`); the client never sends "understood". An
 * understood task completes the session, so "Continue" no longer offers it.
 *
 * The reply is not judged: answering is what counts, and nothing a child writes here takes
 * anything away. No rate limit, because no provider is called.
 */
export class ReplyToComprehensionQuestion {
  constructor(private readonly deps: HelpSessionDependencies) {}

  execute(
    input: ReplyToComprehensionQuestionInput,
  ): AppResultAsync<ComprehensionReplyView, ReplyToComprehensionQuestionError> {
    const { authorization, sessions, audit } = this.deps;

    return authorization.requireInTenant('hint.request').andThen((actor) =>
      parseChildProfileId(input.childProfileId)
        .andThen((id) =>
          parseHelpSessionId(input.sessionId).andThen((sessionId) =>
            parseChildTaskText(input.reply, 'reply').map((reply) => ({ id, sessionId, reply })),
          ),
        )
        .asyncAndThen(
          ({
            id,
            sessionId,
            reply,
          }): AppResultAsync<ComprehensionReplyView, ReplyToComprehensionQuestionError> => {
            if (detectsChildDistress(reply)) {
              return refuseChildInDistress(this.deps, actor, {
                childProfileId: id,
                step: 'reply',
              });
            }
            if (isNonAnswer(reply)) {
              return errAsync(notAnAnswer());
            }
            return ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) => {
              const ref = { ...owner, childProfileId, sessionId };
              return sessions.loadSession(ref, true).andThen((session) => {
                // A lost HTTP response must not turn a stored completion into an error. No new
                // write: return the authenticated session's proven completion, and grant its XP
                // again (keyed by the session, so only a grant that failed the first time lands).
                if (session.status === 'completed' && isSessionUnderstood(session)) {
                  return this.rewarded(childProfileId, sessionId).map(() => ({
                    sessionId,
                    status: 'understood' as const,
                  }));
                }
                const check = openQuestionCheck(session);
                if (check === null) {
                  return errAsync(noOpenQuestion());
                }
                const understood = isTaskUnderstood({
                  result: check.result,
                  comprehensionReplied: true,
                });
                return sessions
                  .recordComprehensionReply(ref, {
                    check,
                    text: reply,
                    completes: understood,
                  })
                  .andThen((outcome) =>
                    outcome === 'recorded' && understood
                      ? this.rewarded(childProfileId, sessionId).map(() => outcome)
                      : okAsync(outcome),
                  )
                  .map((outcome): ComprehensionReplyView => {
                    if (outcome === 'recorded') {
                      audit.record({
                        type: 'guidance.comprehension_replied',
                        tenantId: actor.tenantId,
                        actorId: actor.id,
                        childProfileId,
                        sessionId,
                        understood,
                      });
                    }
                    return { sessionId, status: understood ? 'understood' : 'working' };
                  });
              });
            });
          },
        ),
    );
  }

  /** The understood task's XP (#83); `award` never fails and grants once per session. */
  private rewarded(childProfileId: ChildProfileId, sessionId: HelpSessionId) {
    const { reward } = this.deps;
    return reward === undefined
      ? okAsync(undefined)
      : ResultAsync.fromSafePromise(reward.award(childProfileId, sessionId));
  }
}
