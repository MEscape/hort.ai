/**
 * One step in one of the child's help sessions. The task, its subject and the hint level come from
 * the stored session, never from the caller. Every field is checked by the use case.
 */
export interface HelpSessionStepInput {
  readonly childProfileId: string;
  /** A session started for this child (#17). */
  readonly sessionId: string;
  /** The client's key for this step, so a retried request is recognised instead of counted twice. */
  readonly requestId: string;
}

/** Asking for the next hint of the ladder (#30). */
export type RequestHintInput = HelpSessionStepInput;

/** Checking the child's own answer to the session's task (#14); checked like the task itself. */
export interface CheckAnswerInput extends HelpSessionStepInput {
  /** The answer as the child typed or dictated it. */
  readonly answer: string;
}
