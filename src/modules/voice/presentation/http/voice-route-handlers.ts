import { httpHeadersForError, httpStatusForError, toErrorResponseBody } from '@lib/errors';
import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { SPEECH_LIMITS, VOICE_ERROR_CODES } from '../../application/contracts/voice-constraints';
import { synthesizeSpeechSchema } from '../schemas/synthesize-speech-schema';

import type {
  SynthesizeSpeechInput,
  TranscribeSpeechInput,
} from '../../application/contracts/voice-inputs';
import type {
  SpeechAudioView,
  TranscriptView,
  VoiceConsentView,
} from '../../application/contracts/voice-views';

/** The `SynthesizeSpeech` use case, called by the Route Handler itself. */
export type Synthesize = (input: SynthesizeSpeechInput) => AppResultAsync<SpeechAudioView>;
/** The `TranscribeSpeech` use case, called by the Route Handler itself. */
export type Transcribe = (input: TranscribeSpeechInput) => AppResultAsync<TranscriptView>;

/** A consent use case (read, grant or revoke), called by the Route Handler itself. */
export type ConsentOperation = () => AppResultAsync<VoiceConsentView>;

export interface VoiceRouteHandlers {
  /** `POST /api/voice/speech`: JSON `{ speakerId, text }` in, `audio/mpeg` out. */
  readonly speech: (request: Request, synthesize: Synthesize) => Promise<Response>;
  /** `POST /api/voice/transcription`: multipart field `audio` in, JSON `{ text }` out. */
  readonly transcription: (request: Request, transcribe: Transcribe) => Promise<Response>;
  /** `GET` / `PUT` / `DELETE /api/voice/consent`: no body; JSON `VoiceConsentView` out. */
  readonly consent: (operation: ConsentOperation) => Promise<Response>;
}

const PAYLOAD_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE = 422;
/** A JSON body is the text plus a little structure; anything bigger is not a request of ours. */
const MAX_JSON_BODY_BYTES = 16_384;
/** The multipart envelope (boundaries, part headers) around the recording. */
const MULTIPART_OVERHEAD_BYTES = 16_384;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function refuse(status: number, message: string): Response {
  return Response.json(
    { code: VOICE_ERROR_CODES.validationFailed, message },
    { status, headers: NO_STORE },
  );
}

/** Whether the declared body size fits. A body without a declared size is refused unread. */
function declaredSizeFits(request: Request, maxBytes: number): boolean {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN);
  return Number.isInteger(declared) && declared >= 0 && declared <= maxBytes;
}

/** `audio/webm;codecs=opus` -> `audio/webm`: providers and the allow-list compare bare types. */
function bareType(type: string): string {
  return type.replace(/;.*$/s, '').trim().toLowerCase();
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function readRecording(request: Request): Promise<TranscribeSpeechInput | null> {
  try {
    const audio = (await request.formData()).get('audio');
    if (!(audio instanceof Blob)) {
      return null;
    }
    return { audio: new Uint8Array(await audio.arrayBuffer()), contentType: bareType(audio.type) };
  } catch {
    return null;
  }
}

/**
 * HTTP adapters for the two voice operations. They are Route Handlers rather than Server Actions
 * because both carry binary audio (an `<audio>` element plays the MP3; `MediaRecorder` posts a
 * recording), which the Server Action protocol does not transport well.
 *
 * They only parse and bound the request, call the use case the Route Handler passes in (so the
 * entry point visibly calls it) and map its `Result`; authorization, budgets and the text and
 * recording rules are the use cases'. The recording is read into memory for this request and never
 * written anywhere. `onFailure` sees every failed `Result` (for the log).
 */
type Operation = 'synthesize' | 'transcribe' | 'consent';

export function createVoiceRouteHandlers(options: {
  readonly onFailure: (operation: Operation, error: AppError) => void;
}): VoiceRouteHandlers {
  const failed = (operation: Operation, error: AppError) => {
    options.onFailure(operation, error);
    return Response.json(toErrorResponseBody(error), {
      status: httpStatusForError(error),
      headers: { ...httpHeadersForError(error), ...NO_STORE },
    });
  };

  return {
    async speech(request, synthesize) {
      if (!declaredSizeFits(request, MAX_JSON_BODY_BYTES)) {
        return refuse(PAYLOAD_TOO_LARGE, 'The request body is too large or has no length.');
      }
      const parsed = synthesizeSpeechSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return refuse(UNPROCESSABLE, 'The body must be { speakerId, text }.');
      }
      const result = await synthesize(parsed.data);
      return result.match(
        (spoken) =>
          new Response(new Blob([spoken.audio], { type: spoken.contentType }), {
            headers: { 'Content-Type': spoken.contentType, ...NO_STORE },
          }),
        (error) => failed('synthesize', error),
      );
    },

    async transcription(request, transcribe) {
      if (!declaredSizeFits(request, SPEECH_LIMITS.maxRecordingBytes + MULTIPART_OVERHEAD_BYTES)) {
        return refuse(PAYLOAD_TOO_LARGE, 'The recording is too large or has no length.');
      }
      const recording = await readRecording(request);
      if (recording === null) {
        return refuse(UNSUPPORTED_MEDIA_TYPE, 'Send the recording as multipart field "audio".');
      }
      const result = await transcribe(recording);
      return result.match(
        (transcript) => Response.json({ text: transcript.text }, { headers: NO_STORE }),
        (error) => failed('transcribe', error),
      );
    },

    async consent(operation) {
      const result = await operation();
      return result.match(
        (consent) => Response.json(consent, { headers: NO_STORE }),
        (error) => failed('consent', error),
      );
    },
  };
}
