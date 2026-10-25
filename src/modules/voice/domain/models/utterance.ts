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

type RecordingMime = (typeof SPEECH_LIMITS.recordingTypes)[number];

const ALL_BITS = 0xff;

/** Bytes expected at `offset`; `mask` keeps only the bits that matter (all bits by default). */
interface BytePattern {
  readonly offset: number;
  readonly bytes: readonly number[];
  readonly mask?: readonly number[];
}

/** One way a format can start: every pattern must match. */
type Signature = readonly BytePattern[];

const asciiAt = (offset: number, value: string): BytePattern => ({
  offset,
  bytes: Array.from(value, (char) => char.charCodeAt(0)),
});

/* eslint-disable no-magic-numbers -- the format signatures themselves are the definition */
/** EBML header (WebM/Matroska). */
const WEBM: Signature = [{ offset: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] }];
const OGG: Signature = [asciiAt(0, 'OggS')];
/** ISO base media (MP4/M4A): the first box is `ftyp`, its type at offset 4. */
const MP4: Signature = [asciiAt(4, 'ftyp')];
const WAV: Signature = [asciiAt(0, 'RIFF'), asciiAt(8, 'WAVE')];
/**
 * An ID3v2 tag, or an MPEG audio frame sync (11 set bits) with layer I, II or III. Layer `00` is
 * reserved, so an ADTS/AAC stream does not pass as MP3.
 */
const MP3: readonly Signature[] = [
  [asciiAt(0, 'ID3')],
  ...[0xe2, 0xe4, 0xe6].map((second) => [{ offset: 0, bytes: [0xff, second], mask: [0xff, 0xe6] }]),
];
/* eslint-enable no-magic-numbers -- end of the format signatures */

/**
 * The signatures each accepted type may carry. The declared type comes from the client, so the
 * bytes are checked against it before anything reaches the provider.
 */
const RECORDING_SIGNATURES: Readonly<Record<RecordingMime, readonly Signature[]>> = {
  'audio/webm': [WEBM],
  'audio/ogg': [OGG],
  'audio/mp4': [MP4],
  'audio/mpeg': MP3,
  'audio/wav': [WAV],
  'audio/x-wav': [WAV],
  'audio/wave': [WAV],
};

function isRecordingMime(contentType: string): contentType is RecordingMime {
  return Object.hasOwn(RECORDING_SIGNATURES, contentType);
}

function matches(audio: Uint8Array, { offset, bytes, mask }: BytePattern): boolean {
  return bytes.every((expected, index) => {
    const actual = audio[offset + index];
    const bits = mask?.[index] ?? ALL_BITS;
    return actual !== undefined && (actual & bits) === expected;
  });
}

function carriesSignature(audio: Uint8Array, contentType: RecordingMime): boolean {
  return RECORDING_SIGNATURES[contentType].some((signature) =>
    signature.every((pattern) => matches(audio, pattern)),
  );
}

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

/**
 * A recording the provider can transcribe: not empty, not too large, an audio type it reads, and
 * bytes that carry that type's format signature (`recording_content_mismatch` otherwise).
 */
export function transcribableRecording(
  recording: Recording,
): AppResult<Recording, ValidationAppError> {
  if (recording.audio.byteLength === 0) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingRequired));
  }
  if (recording.audio.byteLength > SPEECH_LIMITS.maxRecordingBytes) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingTooLarge));
  }
  if (!isRecordingMime(recording.contentType)) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingTypeUnsupported));
  }
  if (!carriesSignature(recording.audio, recording.contentType)) {
    return err(invalidVoiceInput('audio', VOICE_VALIDATION_CODES.recordingContentMismatch));
  }
  return ok(recording);
}
