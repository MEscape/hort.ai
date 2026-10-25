import { err, ok, ResultAsync } from '@lib/result';
import type { Result } from '@lib/result';
import { arrayOf, isString, objectOf, optional } from '@lib/utils';

import { buildFeedbackPrompt } from '../../domain/prompt/feedback-prompt';
import { buildHintPrompt } from '../../domain/prompt/hint-prompt';

import type { FeedbackRequest } from '../../domain/models/feedback-request';
import type { HintRequest } from '../../domain/models/hint-request';
import type { FeedbackProvider } from '../../domain/ports/feedback-provider.port';
import type { HintProvider, HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { HintPrompt } from '../../domain/prompt/hint-prompt';

/**
 * The strictest blocking Gemini offers, for every harm category: the reader is a child. A blocked
 * answer has no text and ends in the predefined prompt like any rejected answer.
 */
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

export interface GeminiProviderOptions {
  readonly apiKey: string;
  /** The API origin, `https://generativelanguage.googleapis.com`. */
  readonly apiUrl: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

interface Part {
  text: string | undefined;
}

interface Candidate {
  content: { parts: Part[] | undefined } | undefined;
}

const isGenerateContentResponse = objectOf<{ candidates: Candidate[] | undefined }>({
  candidates: optional(
    arrayOf(
      objectOf<Candidate>({
        content: optional(
          objectOf<{ parts: Part[] | undefined }>({
            parts: optional(arrayOf(objectOf<Part>({ text: optional(isString) }))),
          }),
        ),
      }),
    ),
  ),
});

/** A thrown value reaches the cause by its name only: its message may echo a request. */
function failureOf(thrown: unknown): HintProviderFailure {
  const name = thrown instanceof Error ? thrown.name : 'unknown error';
  return name === 'TimeoutError'
    ? { kind: 'timeout' }
    : { kind: 'unavailable', cause: new Error(`Gemini call could not be completed: ${name}`) };
}

/** A whole answer wrapped in one Markdown code fence, with or without a `json` tag. */
const CODE_FENCE = /^```[a-z]*\s*([\s\S]*?)\s*```$/i;

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

const isObject = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Removes the packaging smaller models put around the one JSON object despite JSON mode: a code
 * fence, a one-element array, or a sentence before or after it. Only the packaging goes; the object
 * itself is returned untouched, so the output contract and the safety and leak checks judge it in
 * full. Anything else (two objects, no object) stays as it was and is rejected by the contract.
 */
function unwrapped(text: string): unknown {
  const trimmed = text.trim();
  const inner = CODE_FENCE.exec(trimmed)?.[1] ?? trimmed;
  const value = parsed(inner);
  if (Array.isArray(value)) {
    return value.length === 1 && isObject(value[0]) ? value[0] : value;
  }
  if (value !== undefined) {
    return value;
  }
  const start = inner.indexOf('{');
  const end = inner.lastIndexOf('}');
  const embedded = start >= 0 && end > start ? parsed(inner.slice(start, end + 1)) : undefined;
  return isObject(embedded) ? embedded : text;
}

/**
 * The model's JSON answer, still untrusted. Text without a JSON object is returned as it is, so the
 * output contract rejects it as invalid output; no text at all (a blocked answer) is `undefined`.
 */
function answerOf(body: unknown): unknown {
  if (!isGenerateContentResponse(body)) {
    return undefined;
  }
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? '').join('');
  return text === '' ? undefined : unwrapped(text);
}

/**
 * Gemini behind the guidance ports (#10, #14): `generateContent` on the Gemini API with the fixed
 * instructions as the system instruction and the child's data as the only user message, JSON
 * output, and the strictest safety settings. Plain `fetch`, no SDK; the key travels in a header,
 * never in the URL, so it cannot end up in a request log.
 *
 * It only transports: every answer is checked against the AI output contract and the child-safety
 * rules by the orchestration, whatever this returns. A missed deadline is `timeout`; any other
 * failure is `unavailable`, with the HTTP status at most, never the key or the child's text.
 */
export class GeminiProvider implements HintProvider, FeedbackProvider {
  private readonly send: typeof fetch;

  constructor(private readonly options: GeminiProviderOptions) {
    this.send = options.fetch ?? fetch;
  }

  suggest(request: HintRequest): ResultAsync<unknown, HintProviderFailure> {
    return this.generate(buildHintPrompt(request));
  }

  word(request: FeedbackRequest): ResultAsync<unknown, HintProviderFailure> {
    return this.generate(buildFeedbackPrompt(request));
  }

  private generate(prompt: HintPrompt): ResultAsync<unknown, HintProviderFailure> {
    return ResultAsync.fromSafePromise(this.call(prompt)).andThen((outcome) => outcome);
  }

  private async call({
    instructions,
    data,
  }: HintPrompt): Promise<Result<unknown, HintProviderFailure>> {
    const { apiKey, apiUrl, modelId, timeoutMs } = this.options;
    const url = `${apiUrl.replace(/\/+$/, '')}/v1beta/models/${modelId}:generateContent`;
    try {
      const response = await this.send(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents: [{ role: 'user', parts: [{ text: data }] }],
          generationConfig: { responseMimeType: 'application/json' },
          safetySettings: SAFETY_SETTINGS,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        return err({
          kind: 'unavailable',
          cause: new Error(`Gemini answered with status ${response.status}`),
        });
      }
      return ok(answerOf(await response.json()));
    } catch (thrown) {
      return err(failureOf(thrown));
    }
  }
}
