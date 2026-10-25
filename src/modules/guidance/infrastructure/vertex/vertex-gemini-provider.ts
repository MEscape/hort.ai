import { err, ok, ResultAsync } from '@lib/result';
import type { Result } from '@lib/result';
import { arrayOf, isString, objectOf, optional } from '@lib/utils';

import { buildFeedbackPrompt } from '../../domain/prompt/feedback-prompt';
import { buildHintPrompt } from '../../domain/prompt/hint-prompt';

import { failureOf } from './service-account-token';

import type { AccessTokenSource } from './service-account-token';
import type { FeedbackRequest } from '../../domain/models/feedback-request';
import type { HintRequest } from '../../domain/models/hint-request';
import type { FeedbackProvider } from '../../domain/ports/feedback-provider.port';
import type { HintProvider, HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { HintPrompt } from '../../domain/prompt/hint-prompt';

/**
 * The strictest blocking Vertex AI offers, for every harm category: the reader is a child. A
 * blocked answer has no text and ends in the predefined prompt like any rejected answer.
 */
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_LOW_AND_ABOVE' }));

export interface VertexGeminiProviderOptions {
  readonly projectId: string;
  /** `eu` or `us` (multi-region), `global`, or a region such as `europe-west4`. */
  readonly location: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  readonly accessToken: AccessTokenSource;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

const isGenerateContentResponse = objectOf<{
  candidates:
    Array<{ content: { parts: Array<{ text: string | undefined }> } | undefined }> | undefined;
}>({
  candidates: optional(
    arrayOf(
      objectOf<{ content: { parts: Array<{ text: string | undefined }> } | undefined }>({
        content: optional(
          objectOf<{ parts: Array<{ text: string | undefined }> }>({
            parts: arrayOf(objectOf<{ text: string | undefined }>({ text: optional(isString) })),
          }),
        ),
      }),
    ),
  ),
});

/** The API host of a location: the multi-regions have their own hosts, `global` has none in its name. */
export function vertexOrigin(location: string): string {
  if (location === 'eu' || location === 'us') {
    return `https://aiplatform.${location}.rep.googleapis.com`;
  }
  return location === 'global'
    ? 'https://aiplatform.googleapis.com'
    : `https://${location}-aiplatform.googleapis.com`;
}

/**
 * The model's JSON answer, still untrusted. Text that is not JSON is returned as it is, so the
 * output contract rejects it as invalid output; no text at all (a blocked answer) is `undefined`.
 */
function answerOf(body: unknown): unknown {
  if (!isGenerateContentResponse(body)) {
    return undefined;
  }
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('');
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Gemini on Vertex AI (Google Cloud) behind the guidance ports (#10, #14): `generateContent` with
 * the fixed instructions as the system instruction and the child's data as the only user message,
 * JSON output, and the strictest safety settings. Plain `fetch`, no SDK.
 *
 * It only transports: every answer is checked against the AI output contract and the child-safety
 * rules by the orchestration, whatever this returns. A missed deadline is `timeout`; any other
 * failure is `unavailable`, with the HTTP status at most, never a token or the child's text.
 */
export class VertexGeminiProvider implements HintProvider, FeedbackProvider {
  private readonly send: typeof fetch;

  constructor(private readonly options: VertexGeminiProviderOptions) {
    this.send = options.fetch ?? fetch;
  }

  suggest(request: HintRequest): ResultAsync<unknown, HintProviderFailure> {
    return this.generate(buildHintPrompt(request));
  }

  word(request: FeedbackRequest): ResultAsync<unknown, HintProviderFailure> {
    return this.generate(buildFeedbackPrompt(request));
  }

  private generate(prompt: HintPrompt): ResultAsync<unknown, HintProviderFailure> {
    return this.options
      .accessToken()
      .andThen((token) => ResultAsync.fromSafePromise(this.call(prompt, token)))
      .andThen((outcome) => outcome);
  }

  private async call(
    { instructions, data }: HintPrompt,
    token: string,
  ): Promise<Result<unknown, HintProviderFailure>> {
    const { projectId, location, modelId, timeoutMs } = this.options;
    const url = `${vertexOrigin(location)}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
    try {
      const response = await this.send(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
          cause: new Error(`Vertex AI answered with status ${response.status}`),
        });
      }
      return ok(answerOf(await response.json()));
    } catch (thrown) {
      return err(failureOf('Vertex AI call', thrown));
    }
  }
}
