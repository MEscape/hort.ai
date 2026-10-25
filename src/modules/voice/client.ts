/** Browser-safe part of the voice module: microphone, read-aloud and fixed lines. No composition or provider imports. */
export { VoiceInputButton } from './presentation/components/voice-input-button';
export type { VoiceInputButtonProps } from './presentation/components/voice-input-button';
export { ReadAloudButton } from './presentation/components/read-aloud-button';
export type { ReadAloudButtonProps } from './presentation/components/read-aloud-button';
export { useSpokenLine } from './presentation/components/use-spoken-line';
export type { SpokenLine } from './presentation/components/use-spoken-line';
export { UI_LINES } from './application/contracts/voice-constraints';
export type {
  CompanionMessageRef,
  SystemPhrase,
  UiLine,
} from './application/contracts/voice-constraints';
