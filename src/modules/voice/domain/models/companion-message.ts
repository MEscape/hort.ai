/** The fixed feedback lines of the help session, spoken from the translated catalog. */
export const READ_ALOUD_FEEDBACK = ['praise', 'partly_correct', 'not_yet', 'unassessed'] as const;
export type ReadAloudFeedback = (typeof READ_ALOUD_FEEDBACK)[number];

/**
 * Names one message of the companion without its words: a hint of the child's open help session
 * (by position, oldest first), the comprehension question waiting for a reply, or a fixed feedback
 * line. The words are looked up on the server, so the browser can never choose them.
 */
export type CompanionMessageRef =
  | { readonly kind: 'hint'; readonly index: number }
  | { readonly kind: 'answer_feedback'; readonly index: number }
  | { readonly kind: 'answer_question'; readonly index: number }
  | { readonly kind: 'question' }
  | { readonly kind: 'feedback'; readonly feedback: ReadAloudFeedback };

/**
 * The wording of a predefined line of the guidance catalog (e.g. `hint.fallback.next_step`) in the
 * request's language, exactly as the child reads it. Supplied by server presentation code, never
 * by the browser.
 */
export type PredefinedWording = (catalogKey: string) => string;
