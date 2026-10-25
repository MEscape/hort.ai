/**
 * Starting (or continuing) a help session, on the child's own task or on a teacher's assignment of
 * the child's class (#33). Every field is checked by the use case.
 */
export interface StartHelpSessionInput {
  readonly childProfileId: string;
  /** The task as the child typed or dictated it. Not read when `assignmentId` is given. */
  readonly task?: string | undefined;
  /** A teacher's assignment as the task: its text comes from the assignments module, never the client. */
  readonly assignmentId?: string | undefined;
  /** One of `HINT_SUBJECTS`; it picks the curriculum that grounds the session's hints. */
  readonly subject: string;
  /** The world island the child started from (`/help?area=`); it wins over a classification once cleared. */
  readonly areaId?: string | undefined;
  /** One of that island's own places; needs `areaId`. */
  readonly placeId?: string | undefined;
}

/** "Continue": the child's open session, if any. */
export interface GetOpenHelpSessionInput {
  readonly childProfileId: string;
}

/** The child's reply to the comprehension question that followed a correct answer (#78). */
export interface ReplyToComprehensionQuestionInput {
  readonly childProfileId: string;
  readonly sessionId: string;
  /** Checked like any child input (`parseChildTaskText`). */
  readonly reply: string;
}
