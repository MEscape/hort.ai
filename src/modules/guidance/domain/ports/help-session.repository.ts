import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type {
  HelpSessionRef,
  HintSessionStore,
  HintSessionStoreError,
  RecordOutcome,
} from './hint-session-store.port';
import type { ChildTaskText } from '../models/child-task-text';
import type { AnswerCheckStep, HelpSession, HelpSessionSource } from '../models/help-session';
import type { ChildProfileId, HelpSessionId } from '../models/ids';
import type { SessionTopic } from '../topic/session-topic';

/** Whose children an operation reaches: the signed-in parent's own, in their own tenant. */
export type HelpSessionOwner = Pick<HelpSessionRef, 'tenantId' | 'ownerId'>;

/** `assignmentId` is set only after the assignments module confirmed the child's class has it (#33). */
export interface NewHelpSession extends HelpSessionSource {
  readonly childProfileId: ChildProfileId;
  /** The open session this one replaces; it ends `abandoned` in the same transaction. */
  readonly replaces: HelpSessionId | null;
  readonly topic: SessionTopic;
}

/**
 * The whole server-side state of help sessions (#17, #78): what the hint ladder records through
 * `HintSessionStore`, plus starting, resuming and the comprehension reply. Every read and write
 * names the tenant, the owner and the child, so another parent's session behaves exactly like one
 * that does not exist. A step is written only while the session is active, once per request id.
 */
export interface HelpSessionRepository extends HintSessionStore {
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

  /** The whole active session `ref` names. Completion recovery alone may also read a completed one. */
  loadSession(
    ref: HelpSessionRef,
    includeCompleted?: boolean,
  ): AppResultAsync<HelpSession, HintSessionStoreError>;

  /**
   * Stores the child's reply to the open question of `check`, once. With `completes`, the session
   * ends `completed` in the same transaction. `duplicate` when the question was answered in the
   * meantime (a concurrent twin of the same reply).
   */
  recordComprehensionReply(
    ref: HelpSessionRef,
    reply: {
      readonly check: AnswerCheckStep;
      readonly text: ChildTaskText;
      readonly completes: boolean;
    },
  ): AppResultAsync<RecordOutcome, HintSessionStoreError>;
}
