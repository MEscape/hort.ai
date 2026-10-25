import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { VOICE_VALIDATION_CODES, invalidVoiceInput } from '../errors/voice-errors';

import { SPEECH_LIMITS } from './speech-limits';

/** A recording as it arrives: bytes and their declared type, held in memory only. */
export interface Recording {
  readonly audio: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

const RECORDING_TYPES: ReadonlySet<string> = new Set(SPEECH_LIMITS.recordingTypes);

/**
 * The text a speaker may say: trimmed, not empty, within the per-request limit. Counted in
 * Unicode code points, as the provider bills them.
 */
export function speakableText(raw: string): AppResult<string, ValidationAppError> {
  const text = raw.trim();
  if (text.length === 0) {
    return err(invalidVoiceInput('text', VOICE_VALIDATION_CODES.textRequired));
  }
  if (Array.from(text).length > SPEECH_LIMITS.maxTextLength) {
    return err(invalidVoiceInput('text', VOICE_VALIDATION_CODES.textTooLong));
  }
  return ok(text);
}

/** A recording the provider can transcribe: not empty, not too large, an audio type it reads. */
export function transcribableRecording(
  recording: Recording,
): AppResult<Recording, ValidationAppError> {
  if (recording.audio.byteLength === 0) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingRequired));
  }
  if (recording.audio.byteLength > SPEECH_LIMITS.maxRecordingBytes) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingTooLarge));
  }
  if (!RECORDING_TYPES.has(recording.contentType)) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingTypeUnsupported));
  }
  return ok(recording);
}
