/**
 * Fixed sentences a channel itself says (Alexa's connection test), from trusted configuration in
 * this module. Hosted speech has no actor and no ticket, so it speaks only text it can match here or
 * in the tutor catalog: never a child's words, never data about a child.
 */
export interface ChannelLines {
  /** `true` when `text` is exactly one of the configured lines (after trimming). */
  isChannelLine(text: string): boolean;
}
