import { err, ok, ResultAsync } from '@lib/result';
import type { Result } from '@lib/result';
import { isFiniteNumber, isString, objectOf, optional } from '@lib/utils';

import { CHILD_SAFETY_VALIDATION_CODES } from '../../domain/errors/child-safety-errors';

import type { ChildSafetyValidationCode } from '../../domain/errors/child-safety-errors';
import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { SafetyClassifier, SafetyScores } from '../../domain/ports/safety-classifier.port';

export interface JevSafetyClassifierOptions {
  readonly apiKey: string;
  /** The API origin, `https://api.typesafe.ai`. */
  readonly apiUrl: string;
  readonly modelId: string;
  readonly timeoutMs: number;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
}

/**
 * One yes/no question per child-safety rule. In English, Jev's strongest language; the text it
 * rates is German. The text is the state, never part of a question, so it cannot rewrite them.
 */
const QUESTIONS = {
  personal_data: {
    code: CHILD_SAFETY_VALIDATION_CODES.asksForPersonalData,
    instructions:
      'The text asks the child for personal information: name, age, address, school, phone number, e-mail, password, a photo, a meeting, or whether the child is alone.',
  },
  secrecy: {
    code: CHILD_SAFETY_VALIDATION_CODES.asksForSecrecy,
    instructions:
      'The text asks the child to keep a secret or to hide something from their parents or other adults.',
  },
  inappropriate: {
    code: CHILD_SAFETY_VALIDATION_CODES.inappropriateContent,
    instructions:
      'The text contains content inappropriate for a primary-school child: insults, violence, sexual content, drugs, self-harm or frightening material.',
  },
  discouraging: {
    code: CHILD_SAFETY_VALIDATION_CODES.discouraging,
    instructions:
      'The text is discouraging, shaming or punishing towards the child, for example calling an answer stupid or saying they keep failing.',
  },
} as const satisfies Record<string, { code: ChildSafetyValidationCode; instructions: string }>;

type QuestionKey = keyof typeof QUESTIONS;

interface NoulAnswer {
  type: string;
  noul: number | undefined;
}

const isNoulAnswer = objectOf<NoulAnswer>({ type: isString, noul: optional(isFiniteNumber) });
const isDecisionResponse = objectOf<{ answers: Record<string, unknown> }>({
  answers: (value): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value),
});

/** A thrown value reaches the cause by its name only: its message may echo a request. */
function failureOf(thrown: unknown): HintProviderFailure {
  const name = thrown instanceof Error ? thrown.name : 'unknown error';
  return name === 'TimeoutError'
    ? { kind: 'timeout' }
    : { kind: 'unavailable', cause: new Error(`Jev call could not be completed: ${name}`) };
}

/**
 * Every rule with its score. A rule Jev did not answer counts as certain (1), so a missing answer
 * flags the text instead of letting it through.
 */
function scoresOf(answers: Record<string, unknown>): SafetyScores {
  return Object.fromEntries(
    (Object.keys(QUESTIONS) as QuestionKey[]).map((key) => {
      const answer = answers[key];
      const score = isNoulAnswer(answer) && answer.noul !== undefined ? answer.noul : 1;
      return [QUESTIONS[key].code, score];
    }),
  );
}

/**
 * TypeSafe's Jev decision model as the second child-safety check (#11): one `systemone` request
 * with a yes/no ("noul") question per rule, answered as probabilities, never as text. Plain
 * `fetch`, no SDK. A missed deadline is `timeout`; any other failure is `unavailable`, with the
 * HTTP status at most, never the key or the rated text.
 */
export class JevSafetyClassifier implements SafetyClassifier {
  private readonly send: typeof fetch;

  constructor(private readonly options: JevSafetyClassifierOptions) {
    this.send = options.fetch ?? fetch;
  }

  classify(text: string): ResultAsync<SafetyScores, HintProviderFailure> {
    return ResultAsync.fromSafePromise(this.call(text)).andThen((outcome) => outcome);
  }

  private async call(text: string): Promise<Result<SafetyScores, HintProviderFailure>> {
    const { apiKey, apiUrl, modelId, timeoutMs } = this.options;
    const questions = Object.fromEntries(
      Object.entries(QUESTIONS).map(([key, { instructions }]) => [
        key,
        { type: 'noul', instructions },
      ]),
    );
    try {
      const response = await this.send(`${apiUrl.replace(/\/+$/, '')}/v1/systemone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelId, state: text, questions }),
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
        ? ok(scoresOf(body.answers))
        : err({ kind: 'unavailable', cause: new Error('Jev returned an unknown shape.') });
    } catch (thrown) {
      return err(failureOf(thrown));
    }
  }
}
