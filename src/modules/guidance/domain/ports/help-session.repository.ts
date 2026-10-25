import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ChildTaskText } from '../models/child-task-text';
import type {
  AnswerCheckStep,
  GivenHint,
  HelpSession,
  NewAnswerCheck,
} from '../models/help-session';
import type { HintSubject } from '../models/hint-subject';
import type { ChildProfileId, HelpSessionId } from '../models/ids';

/** Whose children an operation reaches: the signed-in parent's own, in their own tenant. */
export interface HelpSessionOwner {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}

/** One ACTIVE session of one of the owner's children. Anything else is "not found". */
export interface HelpSessionRef extends HelpSessionOwner {
  readonly childProfileId: ChildProfileId;
  readonly sessionId: HelpSessionId;
}

export interface NewHelpSession {
  readonly childProfileId: ChildProfileId;
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
  /** The open session this one replaces; it ends `abandoned` in the same transaction. */
  readonly replaces: HelpSessionId | null;
}

/** `recorded`: this call stored the step. `duplicate`: its request id was stored before; nothing changed. */
export type StepOutcome = 'recorded' | 'duplicate';

export type HelpSessionLoadError = NotFoundAppError | InfrastructureAppError;

/**
 * The server-side state of help sessions (#17, #78). Every read and write names the tenant, the
 * owner and the child, so another parent's session behaves exactly like one that does not exist.
 * Every step is keyed by the caller's request id and stored once, so a retried request changes
 * nothing; a step is written only while the session is active.
 */
export interface HelpSessionRepository {
  /**
   * Starts a session. The database holds at most one active session per child, so a concurrent
   * twin start returns the session that won (`created: false`) instead of a second one.
   */
  start(
    owner: HelpSessionOwner,
    session: NewHelpSession,
  ): AppResultAsync<
    { readonly session: HelpSession; readonly created: boolean },
    InfrastructureAppError
  >;

  /** The child's active session, for "Continue"; `null` when there is none. */
  findOpen(
    owner: HelpSessionOwner,
    childProfileId: ChildProfileId,
  ): AppResultAsync<HelpSession | null, InfrastructureAppError>;

  /** The active session `ref` names. */
  load(ref: HelpSessionRef): AppResultAsync<HelpSession, HelpSessionLoadError>;

  /** Stores a hint and moves the session to its level. */
  recordHint(
    ref: HelpSessionRef,
    hint: GivenHint,
  ): AppResultAsync<StepOutcome, HelpSessionLoadError>;

  /**
   * Stores an answer check with the hint level the session is on (read in the same transaction,
   * never passed in), and the comprehension question that follows a correct answer.
   */
  recordAnswerCheck(
    ref: HelpSessionRef,
    check: NewAnswerCheck,
  ): AppResultAsync<StepOutcome, HelpSessionLoadError>;

  /**
   * Stores the child's reply to the open question of `check`, once. With
   * `completes`, the session ends `completed` in the same transaction. `duplicate` when the
   * question was answered in the meantime (a concurrent twin of the same reply).
   */
  recordComprehensionReply(
    ref: HelpSessionRef,
    reply: {
      readonly check: AnswerCheckStep;
      readonly text: ChildTaskText;
      readonly completes: boolean;
    },
  ): AppResultAsync<StepOutcome, HelpSessionLoadError>;
}
