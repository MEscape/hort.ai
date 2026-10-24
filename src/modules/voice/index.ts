/**
 * Server-side public API of the voice module: the tutors and the narrator speak (text-to-speech),
 * and a child's recording becomes text (speech-to-text). Framework entry points mount the route
 * handlers; nothing here is browser code.
 */
export { getVoiceCommands, getVoiceQueries, getVoiceRouteHandlers } from './composition';
export type { VoiceRouteHandlers } from './presentation/http/voice-route-handlers';
export {
  SPEECH_LIMITS,
  VOICE_ERROR_CODES,
  VOICE_VALIDATION_CODES,
} from './application/contracts/voice-constraints';
export type {
  VoiceErrorCode,
  VoiceValidationCode,
} from './application/contracts/voice-constraints';
export type {
  SynthesizeSpeechInput,
  TranscribeSpeechInput,
} from './application/contracts/voice-inputs';
export type {
  SpeechAudioView,
  TranscriptView,
  VoiceConsentView,
} from './application/contracts/voice-views';
