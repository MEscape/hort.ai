/**
 * Why the predefined prompt was used instead of the AI's answer: the provider timed out or failed,
 * the answer broke the output contract (#6), or it broke the child-safety rules (#11).
 */
export type HintFallbackReason =
  'timeout' | 'provider_unavailable' | 'invalid_output' | 'unsafe_output';
