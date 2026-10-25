import { httpHeadersForError, httpStatusForError, toErrorResponseBody } from '@lib/errors';
import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import {
  SPEECH_LIMITS,
  VOICE_ERROR_CODES,
  VOICE_VALIDATION_CODES,
} from '../../application/contracts/voice-constraints';
import { synthesizeSpeechSchema } from '../schemas/synthesize-speech-schema';

import type { VoiceValidationCode } from '../../application/contracts/voice-constraints';
import type {
  SynthesizeSpeechInput,
  TranscribeSpeechInput,
} from '../../application/contracts/voice-inputs';
import type { SpeechAudioView, TranscriptView } from '../../application/contracts/voice-views';

/** The `SynthesizeSpeech` use case, called by the Route Handler itself. */
export type Synthesize = (input: SynthesizeSpeechInput) => AppResultAsync<SpeechAudioView>;
/** The `TranscribeSpeech` use case, called by the Route Handler itself. */
export type Transcribe = (input: TranscribeSpeechInput) => AppResultAsync<TranscriptView>;
/** A cheap session lookup: fails (unauthenticated) for an anonymous caller. Not authorization. */
export type SignedIn = () => AppResultAsync<unknown>;

export interface VoiceRouteHandlers {
  /** `POST /api/voice/speech`: JSON `{ speakerId, phrase }` or `{ speakerId, ticket }` in, MP3 out. */
  readonly speech: (request: Request, synthesize: Synthesize) => Promise<Response>;
  /** `POST /api/voice/transcription`: multipart `childProfileId` + `audio` in, JSON `{ text }` out. */
  readonly transcription: (request: Request, transcribe: Transcribe) => Promise<Response>;
}

const PAYLOAD_TOO_LARGE = 413;
const UNSUPPORTED_MEDIA_TYPE = 415;
const UNPROCESSABLE = 422;
/** A JSON body is a ticket plus a little structure; anything bigger is not a request of ours. */
const MAX_JSON_BODY_BYTES = 16_384;
/** The multipart envelope (boundaries, part headers, the profile id) around the recording. */
const MULTIPART_OVERHEAD_BYTES = 16_384;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

function refuse(
  status: number,
  message: string,
  fieldErrors?: Record<string, VoiceValidationCode[]>,
): Response {
  return Response.json(
    { code: VOICE_ERROR_CODES.validationFailed, message, ...(fieldErrors && { fieldErrors }) },
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

/** Whether the client tried to choose the words: refused with its own code, not a generic shape error. */
function carriesFreeText(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'text' in body;
}

type ReadRecording =
  | { readonly kind: 'ok'; readonly input: TranscribeSpeechInput }
  | { readonly kind: 'no_audio' }
  | { readonly kind: 'no_child_profile' };

async function readRecording(request: Request): Promise<ReadRecording> {
  try {
    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) {
      return { kind: 'no_audio' };
    }
    const childProfileId = form.get('childProfileId');
    if (typeof childProfileId !== 'string' || childProfileId === '') {
      return { kind: 'no_child_profile' };
    }
    return {
      kind: 'ok',
      input: {
        childProfileId,
        audio: new Uint8Array(await audio.arrayBuffer()),
        contentType: bareType(audio.type),
      },
    };
  } catch {
    return { kind: 'no_audio' };
  }
}

/**
 * HTTP adapters for the two voice operations. They are Route Handlers rather than Server Actions
 * because both carry binary audio (an `<audio>` element plays the MP3; `MediaRecorder` posts a
 * recording), which the Server Action protocol does not transport well.
 *
 * They only parse and bound the request, call the use case the Route Handler passes in (so the
 * entry point visibly calls it) and map its `Result`; authorization, consent, budgets and the text
 * and recording rules are the use cases'. The speech body names a catalog line or a ticket and
 * never words; one with `text` is refused. The recording is read into memory for this request and
 * never written anywhere, and only after `signedIn` found a session, so an anonymous caller cannot
 * make the server parse megabytes. `onFailure` sees every failed `Result` (for the log).
 */
export function createVoiceRouteHandlers(options: {
  readonly onFailure: (operation: 'synthesize' | 'transcribe', error: AppError) => void;
  readonly signedIn: SignedIn;
}): VoiceRouteHandlers {
  const failed = (operation: 'synthesize' | 'transcribe', error: AppError) => {
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
      const body = await readJson(request);
      if (carriesFreeText(body)) {
        return refuse(UNPROCESSABLE, 'Only catalog lines and validated hints are spoken.', {
          text: [VOICE_VALIDATION_CODES.freeTextRefused],
        });
      }
      const parsed = synthesizeSpeechSchema.safeParse(body);
      if (!parsed.success) {
        return refuse(
          UNPROCESSABLE,
          'The body must be { speakerId, phrase } or { speakerId, ticket }.',
        );
      }
      const { speakerId } = parsed.data;
      const result = await synthesize(
        'phrase' in parsed.data
          ? { speakerId, source: { kind: 'phrase', phrase: parsed.data.phrase } }
          : { speakerId, source: { kind: 'ticket', ticket: parsed.data.ticket } },
      );
      return result.match(
        (spoken) =>
          new Response(new Blob([spoken.audio], { type: spoken.contentType }), {
            headers: { 'Content-Type': spoken.contentType, ...NO_STORE },
          }),
        (error) => failed('synthesize', error),
      );
    },

    async transcription(request, transcribe) {
      // Up to 4 MiB of multipart is parsed into memory below: only for a signed-in caller.
      const session = await options.signedIn();
      if (session.isErr()) {
        return failed('transcribe', session.error);
      }
      if (!declaredSizeFits(request, SPEECH_LIMITS.maxRecordingBytes + MULTIPART_OVERHEAD_BYTES)) {
        return refuse(PAYLOAD_TOO_LARGE, 'The recording is too large or has no length.');
      }
      const read = await readRecording(request);
      if (read.kind === 'no_audio') {
        return refuse(UNSUPPORTED_MEDIA_TYPE, 'Send the recording as multipart field "audio".');
      }
      if (read.kind === 'no_child_profile') {
        return refuse(UNPROCESSABLE, 'Name the speaking child in field "childProfileId".', {
          childProfileId: [VOICE_VALIDATION_CODES.childProfileRequired],
        });
      }
      const result = await transcribe(read.input);
      return result.match(
        (transcript) => Response.json({ text: transcript.text }, { headers: NO_STORE }),
        (error) => failed('transcribe', error),
      );
    },
  };
}
