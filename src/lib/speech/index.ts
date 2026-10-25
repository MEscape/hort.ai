export { SYNTHESIZED_AUDIO_TYPE } from './speech-provider';
export type {
  SpeechProvider,
  SynthesisRequest,
  SynthesizedSpeech,
  Transcript,
  TranscriptionRequest,
} from './speech-provider';
export {
  SPEECH_ERROR_CODES,
  isRetryableSpeechError,
  speechQuotaExceeded,
  speechRejected,
  speechThrottled,
  speechUnavailable,
} from './speech-errors';
export type { SpeechError } from './speech-errors';
