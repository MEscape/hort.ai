/**
 * Decides whether a text may be read aloud to a child. Text from a request is never trusted: it
 * passes the same content and child-safety rules as an AI answer before a voice speaks it.
 */
export interface SpokenTextGuard {
  /** `true` when the text breaks no rule. */
  isSafe(text: string): boolean;
}
