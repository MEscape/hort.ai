/**
 * Server-side public API of the voice module: the tutors and the narrator speak (text-to-speech),
 * and a child's recording becomes text (speech-to-text). Framework entry points mount the route
 * handlers; server code that receives a validated hint from the guidance orchestrator issues a
 * speech ticket for it (`getVoiceQueries().issueSpeechTicket`). Nothing here is browser code.
 */
export { getVoiceQueries, getVoiceRouteHandlers } from './composition';
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
  SpeechSource,
  SynthesizeSpeechInput,
  TranscribeSpeechInput,
} from './application/contracts/voice-inputs';
export type {
  SpeechAudioView,
  SpeechTicketView,
  TranscriptView,
} from './application/contracts/voice-views';
