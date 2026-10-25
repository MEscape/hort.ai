import type { AuthorizationError } from '@modules/auth';

import { conflictError } from '@lib/errors';
import type {
  ConflictAppError,
  InfrastructureAppError,
  NotFoundAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { isTaskUnderstood } from '../../domain/answer-check/answer-decision';
import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';
import { parseChildTaskText } from '../../domain/models/child-task-text';
import { openQuestionCheck } from '../../domain/models/help-session';
import { parseChildProfileId, parseHelpSessionId } from '../../domain/models/ids';
import { checkForDistress } from '../services/distress-check';
import { ownChildScope } from '../services/own-child-session';

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

/**
 * The child replies to the comprehension question that followed a correct answer (#78). The reply
 * is checked like any child input and stored once. Whether the task is now understood is decided
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
            parseChildTaskText(input.reply, 'reply')
              .andThen((reply) => checkForDistress(audit, reply, 'reply'))
              .map((reply) => ({ id, sessionId, reply })),
          ),
        )
        .asyncAndThen(({ id, sessionId, reply }) =>
          ownChildScope(this.deps, actor, id).andThen(({ owner, childProfileId }) => {
            const ref = { ...owner, childProfileId, sessionId };
            return sessions.loadSession(ref).andThen((session) => {
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
          }),
        ),
    );
  }
}
