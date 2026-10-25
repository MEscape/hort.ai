/**
 * Server-side public API of the voice module: the tutors and the narrator speak (text-to-speech),
 * and a child's recording becomes text (speech-to-text). Framework entry points mount the route
 * handlers; server code that receives a validated hint from the guidance orchestrator issues a
 * speech ticket for it (`getVoiceQueries().issueSpeechTicket`). Nothing here is browser code.
 */
export { getHostedSpeech, getVoiceQueries, getVoiceRouteHandlers } from './composition';
export type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';
export {
  SPEECH_LIMITS,
  SYSTEM_PHRASES,
  VOICE_ERROR_CODES,
  VOICE_VALIDATION_CODES,
} from './application/contracts/voice-constraints';
export type {
  SystemPhrase,
  VoiceErrorCode,
  VoiceValidationCode,
} from './application/contracts/voice-constraints';
export type {
  HostedSpeechInput,
  HostedSpeechSource,
  SpeechSource,
  SynthesizeSpeechInput,
  TranscribeSpeechInput,
} from './application/contracts/voice-inputs';
export type {
  HostedSpeechView,
  SpeechAudioView,
  SpeechTicketView,
  TranscriptView,
} from './application/contracts/voice-views';

/** The module's message catalogs, registered in `src/i18n/locales`. */
export { default as enVoice } from './presentation/i18n/en.json';
export { default as deVoice } from './presentation/i18n/de.json';
