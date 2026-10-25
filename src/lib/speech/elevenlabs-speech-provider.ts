import { err, ok, ResultAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { isString, nullable, objectOf, optional } from '@lib/utils';

import {
  speechQuotaExceeded,
  speechRejected,
  speechThrottled,
  speechUnavailable,
} from './speech-errors';
import { SYNTHESIZED_AUDIO_TYPE } from './speech-provider';

import type { SpeechError } from './speech-errors';
import type {
  SpeechProvider,
  SynthesisRequest,
  SynthesizedSpeech,
  Transcript,
  TranscriptionRequest,
} from './speech-provider';

/** MP3 at 44.1 kHz and 128 kbit/s: available on every plan, plays in every browser. */
const OUTPUT_FORMAT = 'mp3_44100_128';
/** ElevenLabs voice ids are short alphanumeric tokens; anything else never reaches the URL path. */
const VOICE_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;
/** Enough of an error body to read its `detail.status`, never enough to buffer anything large. */
const ERROR_BODY_PEEK_CHARS = 2048;

const REQUEST_TIMEOUT = 408;
const PAYMENT_REQUIRED = 402;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR_FROM = 500;

/** The `detail.status` values ElevenLabs uses for a used-up quota or a voice the plan does not include. */
const QUOTA_STATUSES: ReadonlySet<string> = new Set([
  'quota_exceeded',
  'paid_plan_required',
  'payment_required',
  'voice_limit_reached',
]);

export interface ElevenLabsSpeechProviderOptions {
  /** Server-only secret, sent as `xi-api-key`. Never logged, never part of an error. */
  readonly apiKey: string;
  /** API origin without a trailing path, for example `https://api.elevenlabs.io`. */
  readonly apiUrl: string;
  readonly ttsModelId: string;
  readonly sttModelId: string;
  readonly timeoutMs: number;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

const isTranscriptBody = objectOf<{ text: string; language_code: string | null | undefined }>({
  text: isString,
  language_code: optional(nullable(isString)),
});

const isErrorBody = objectOf<{ detail: { status: string | undefined } }>({
  detail: objectOf<{ status: string | undefined }>({ status: optional(isString) }),
});

/** The name of a thrown value, which is all that may reach an error: its message is the provider's. */
function errorName(thrown: unknown): string {
  return thrown instanceof Error ? thrown.name : 'unknown error';
}

async function providerStatus(response: Response): Promise<string | null> {
  try {
    const text = (await response.text()).slice(0, ERROR_BODY_PEEK_CHARS);
    const body: unknown = JSON.parse(text);
    return isErrorBody(body) ? (body.detail.status ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Sorts a refused call: what waiting can fix, what needs a plan or quota, and what needs a
 * configuration change. Only the HTTP status and ElevenLabs' `detail.status` reach the cause.
 */
async function failureOf(operation: string, response: Response): Promise<SpeechError> {
  const status = await providerStatus(response);
  const cause = new Error(
    `ElevenLabs ${operation} failed with status ${response.status}${status ? ` (${status})` : ''}`,
  );
  if (response.status === PAYMENT_REQUIRED || (status !== null && QUOTA_STATUSES.has(status))) {
    return speechQuotaExceeded(cause);
  }
  if (response.status === TOO_MANY_REQUESTS) {
    return speechThrottled(cause);
  }
  if (response.status >= SERVER_ERROR_FROM || response.status === REQUEST_TIMEOUT) {
    return speechUnavailable(cause);
  }
  return speechRejected(cause);
}

/**
 * Text-to-speech and speech-to-text over the ElevenLabs REST API (`/v1/text-to-speech`,
 * `/v1/speech-to-text`). Plain `fetch`, no SDK: two calls do not justify a dependency.
 *
 * Nothing is stored: a recording is sent once and dropped with the request, the synthesized MP3
 * is returned to the caller. Every failure becomes a `SpeechError` without the key or the
 * provider's message text.
 */
export class ElevenLabsSpeechProvider implements SpeechProvider {
  private readonly send: typeof fetch;

  constructor(private readonly options: ElevenLabsSpeechProviderOptions) {
    this.send = options.fetch ?? fetch;
  }

  synthesize(request: SynthesisRequest): AppResultAsync<SynthesizedSpeech, SpeechError> {
    return ResultAsync.fromSafePromise(this.synthesizeOnce(request)).andThen((outcome) => outcome);
  }

  transcribe(request: TranscriptionRequest): AppResultAsync<Transcript, SpeechError> {
    return ResultAsync.fromSafePromise(this.transcribeOnce(request)).andThen((outcome) => outcome);
  }

  private async synthesizeOnce(request: SynthesisRequest) {
    if (!VOICE_ID_PATTERN.test(request.voiceId)) {
      return err(speechRejected(new Error('The voice id is not a valid ElevenLabs voice id.')));
    }
    const url = `${this.endpoint(`/v1/text-to-speech/${request.voiceId}`)}?output_format=${OUTPUT_FORMAT}`;
    const response = await this.call('text-to-speech', url, {
      headers: { 'Content-Type': 'application/json', Accept: SYNTHESIZED_AUDIO_TYPE },
      body: JSON.stringify({ text: request.text, model_id: this.options.ttsModelId }),
    });
    if (response.isErr()) {
      return err(response.error);
    }
    try {
      const spoken: SynthesizedSpeech = {
        audio: new Uint8Array(await response.value.arrayBuffer()),
        contentType: SYNTHESIZED_AUDIO_TYPE,
      };
      return spoken.audio.byteLength > 0
        ? ok(spoken)
        : err(speechUnavailable(new Error('ElevenLabs text-to-speech returned no audio.')));
    } catch (thrown) {
      return err(
        speechUnavailable(new Error(`ElevenLabs audio read failed: ${errorName(thrown)}`)),
      );
    }
  }

  private async transcribeOnce(request: TranscriptionRequest) {
    const form = new FormData();
    form.set('model_id', this.options.sttModelId);
    form.set('language_code', request.languageCode);
    // Without it Scribe adds tags such as "(lacht)" that are not what the child said.
    form.set('tag_audio_events', 'false');
    form.set('file', new Blob([request.audio], { type: request.contentType }), 'recording');

    const response = await this.call('speech-to-text', this.endpoint('/v1/speech-to-text'), {
      headers: { Accept: 'application/json' },
      body: form,
    });
    if (response.isErr()) {
      return err(response.error);
    }
    try {
      const body: unknown = await response.value.json();
      return isTranscriptBody(body)
        ? ok({ text: body.text.trim(), languageCode: body.language_code ?? null })
        : err(speechUnavailable(new Error('ElevenLabs speech-to-text returned an unknown shape.')));
    } catch (thrown) {
      return err(
        speechUnavailable(new Error(`ElevenLabs transcript read failed: ${errorName(thrown)}`)),
      );
    }
  }

  private endpoint(path: string): string {
    return `${this.options.apiUrl.replace(/\/+$/, '')}${path}`;
  }

  private async call(
    operation: string,
    url: string,
    init: { readonly headers: Record<string, string>; readonly body: BodyInit },
  ) {
    let response: Response;
    try {
      response = await this.send(url, {
        method: 'POST',
        headers: { ...init.headers, 'xi-api-key': this.options.apiKey },
        body: init.body,
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (thrown) {
      return err(
        speechUnavailable(
          new Error(`ElevenLabs ${operation} could not be completed: ${errorName(thrown)}`),
        ),
      );
    }
    return response.ok ? ok(response) : err(await failureOf(operation, response));
  }
}
