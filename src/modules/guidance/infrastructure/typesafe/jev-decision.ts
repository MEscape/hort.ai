import { err, ok } from '@lib/result';
import type { Result } from '@lib/result';
import { isFiniteNumber, isPlainObject, isString, objectOf, optional } from '@lib/utils';

import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';

/** How to reach TypeSafe's Jev decision model. */
export interface JevOptions {
  readonly apiKey: string;
  /** The API origin, `https://api.typesafe.ai`. */
  readonly apiUrl: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

interface NoulAnswer {
  type: string;
  noul: number | undefined;
}

const isNoulAnswer = objectOf<NoulAnswer>({ type: isString, noul: optional(isFiniteNumber) });
const isDecisionResponse = objectOf<{ answers: Record<string, unknown> }>({
  answers: isPlainObject,
});

/** The probability of a yes/no answer, or `undefined` when Jev did not answer it as one. */
export function noulScoreOf(answer: unknown): number | undefined {
  return isNoulAnswer(answer) ? answer.noul : undefined;
}

/** A thrown value reaches the cause by its name only: its message may echo a request. */
function failureOf(thrown: unknown): HintProviderFailure {
  const name = thrown instanceof Error ? thrown.name : 'unknown error';
  return name === 'TimeoutError'
    ? { kind: 'timeout' }
    : { kind: 'unavailable', cause: new Error(`Jev call could not be completed: ${name}`) };
}

/**
 * One `POST /v1/systemone` with fixed yes/no ("noul") questions about `state`, which is data and
 * never part of a question. Returns Jev's answers by question key, unchecked. Plain `fetch`, no SDK.
 * A missed deadline is `timeout`; any other failure is `unavailable`, with the HTTP status at most,
 * never the key or the state.
 */
export async function askJev(
  { apiKey, apiUrl, modelId, timeoutMs, fetch: send = fetch }: JevOptions,
  {
    state,
    questions,
  }: { readonly state: string; readonly questions: Readonly<Record<string, string>> },
): Promise<Result<Record<string, unknown>, HintProviderFailure>> {
  const noulQuestions = Object.fromEntries(
    Object.entries(questions).map(([key, instructions]) => [key, { type: 'noul', instructions }]),
  );
  try {
    const response = await send(`${apiUrl.replace(/\/+$/, '')}/v1/systemone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId, state, questions: noulQuestions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return err({
        kind: 'unavailable',
        cause: new Error(`Jev answered with status ${response.status}`),
      });
    }
    const body: unknown = await response.json();
    return isDecisionResponse(body)
      ? ok(body.answers)
      : err({ kind: 'unavailable', cause: new Error('Jev returned an unknown shape.') });
  } catch (thrown) {
    return err(failureOf(thrown));
  }
}
