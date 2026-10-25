/** 4 MiB. */
const MAX_RECORDING_BYTES = 4_194_304;

/**
 * How much one request may ask of the speech provider. Every synthesized character is billed
 * (ElevenLabs Starter: 40,000 characters a month), so a tutor's reply is spoken in short pieces.
 */
export const SPEECH_LIMITS = {
  /** One spoken reply: a few sentences. Longer text is refused, never silently cut. */
  maxTextLength: 400,
  /** A child's recording: about a minute of compressed audio, several seconds of WAV. */
  maxRecordingBytes: MAX_RECORDING_BYTES,
  /** What a browser's `MediaRecorder` or a file picker produces, without parameters. */
  recordingTypes: [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
  ],
  /** The children speak German (ISO 639-3). */
  languageCode: 'deu',
} as const;
