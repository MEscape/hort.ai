import { ResultAsync } from '@lib/result';

import { CHILD_SAFETY_VALIDATION_CODES } from '../../domain/errors/child-safety-errors';

import { askJev, noulScoreOf } from './jev-decision';

import type { JevOptions } from './jev-decision';
import type { ChildSafetyValidationCode } from '../../domain/errors/child-safety-errors';
import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type { SafetyClassifier, SafetyScores } from '../../domain/ports/safety-classifier.port';

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

const INSTRUCTIONS = Object.fromEntries(
  Object.entries(QUESTIONS).map(([key, { instructions }]) => [key, instructions]),
);

/**
 * Every rule with its score. A rule Jev did not answer counts as certain (1), so a missing answer
 * flags the text instead of letting it through.
 */
function scoresOf(answers: Record<string, unknown>): SafetyScores {
  return Object.fromEntries(
    (Object.keys(QUESTIONS) as QuestionKey[]).map((key) => [
      QUESTIONS[key].code,
      noulScoreOf(answers[key]) ?? 1,
    ]),
  );
}

/**
 * TypeSafe's Jev decision model as the second child-safety check (#11): one `systemone` request
 * with a yes/no ("noul") question per rule, answered as probabilities, never as text.
 */
export class JevSafetyClassifier implements SafetyClassifier {
  constructor(private readonly options: JevOptions) {}

  classify(text: string): ResultAsync<SafetyScores, HintProviderFailure> {
    return ResultAsync.fromSafePromise(
      askJev(this.options, { state: text, questions: INSTRUCTIONS }),
    ).andThen((answers) => answers.map(scoresOf));
  }
}
