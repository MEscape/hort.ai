import type { ActorId, TenantId } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { AssessmentResult } from '../ai-output/ai-output';
import type { GivenHint, HintLadderState } from '../models/help-session-state';
import type { ChildProfileId, HelpSessionId, StepRequestId } from '../models/ids';

/** One help session of one child, named by the signed-in parent's tenant and identity. */
export interface HelpSessionRef {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
  readonly childProfileId: ChildProfileId;
  readonly sessionId: HelpSessionId;
}

/** Who decided an answer's result: the teacher's solution key or the AI's validated assessment. */
export type AnswerAssessor = 'solution_key' | 'ai';

/**
 * One checked answer (#78). The texts are the validated AI texts the child saw, `null` where the
 * predefined text was shown; `question` is `null` when no comprehension question was asked.
 */
export interface RecordedAnswerCheck {
  readonly requestId: StepRequestId;
  readonly answer: string;
  readonly result: AssessmentResult | null;
  readonly assessedBy: AnswerAssessor | null;
  readonly feedbackText: string | null;
  readonly question: { readonly text: string | null } | null;
}

/** A step stored now, or one already stored under the same request id (a retried request). */
export type RecordOutcome = 'recorded' | 'duplicate';

export type HintSessionStoreError = NotFoundAppError | InfrastructureAppError;

/**
 * The server-side state of help sessions (#17) as the hint ladder needs it. Only an ACTIVE session of
 * exactly this tenant, owner and child is found; any other is "not found", including one that ended
 * or changed hands between loading and recording. Recording the same request id twice stores it once.
 */
export interface HintSessionStore {
  load(ref: HelpSessionRef): AppResultAsync<HintLadderState, HintSessionStoreError>;
  recordHint(
    ref: HelpSessionRef,
    hint: GivenHint,
  ): AppResultAsync<RecordOutcome, HintSessionStoreError>;
  /** The hint level at the time is taken from the stored session, not passed in. */
  recordAnswerCheck(
    ref: HelpSessionRef,
    check: RecordedAnswerCheck,
  ): AppResultAsync<RecordOutcome, HintSessionStoreError>;
}
