/** Browser-safe part of the voice module: playing its fixed lines. No composition or provider imports. */
export { useSpokenLine } from './presentation/components/use-spoken-line';
export type { SpokenLine } from './presentation/components/use-spoken-line';
export { UI_LINES } from './application/contracts/voice-constraints';
export type { SystemPhrase, UiLine } from './application/contracts/voice-constraints';
