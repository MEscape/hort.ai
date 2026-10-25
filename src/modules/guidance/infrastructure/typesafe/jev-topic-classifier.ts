import { ResultAsync } from '@lib/result';

import { HINT_SUBJECTS } from '../../domain/models/hint-subject';
import {
  CHILD_MESSAGE_INTENTS,
  TOPIC_CLASSIFICATION_VERSION,
} from '../../domain/topic/topic-classification';

import { askJev, noulScoreOf } from './jev-decision';

import type { JevOptions } from './jev-decision';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';
import type {
  TopicClassificationRequest,
  TopicClassifier,
} from '../../domain/ports/topic-classifier.port';

/** `findRelevantCompetencies` returns at most five; more would only make the request longer. */
const MAX_CANDIDATES = 5;

/**
 * Fixed yes/no questions, in English (Jev's strongest language; the message is German). They name
 * the fields of the state and never contain the child's text or a competency's text: both stay in
 * the state as data, so neither can rewrite a question (curriculum.md, untrusted-data contract).
 */
const INTENT_QUESTIONS = {
  homework:
    'The child’s message in the field "message" of the state is a school homework or exam-practice task the child is working on, or a question about such a task.',
  curiosity:
    'The child’s message in the field "message" of the state is a general knowledge question the child is curious about, not a homework task.',
  small_talk:
    'The child’s message in the field "message" of the state is a greeting, small talk or a personal chat with the companion, not a homework task and not a knowledge question.',
} as const satisfies Record<(typeof CHILD_MESSAGE_INTENTS)[number], string>;

const SUBJECT_QUESTIONS = {
  math: 'The task in the field "message" of the state belongs to the school subject mathematics.',
  german:
    'The task in the field "message" of the state belongs to the school subject German (reading, writing, spelling, grammar).',
  general_studies:
    'The task in the field "message" of the state belongs to the primary-school subject general studies (nature, society, technology, history, geography).',
  english:
    'The task in the field "message" of the state belongs to the school subject English as a foreign language.',
} as const satisfies Record<(typeof HINT_SUBJECTS)[number], string>;

const candidateQuestion = (number: number) =>
  `The task in the field "message" of the state practises the competency given as candidate number ${number} in the field "candidates" of the state.`;

const intentKey = (intent: string) => `intent_${intent}`;
const subjectKey = (subject: string) => `subject_${subject}`;
const candidateKey = (number: number) => `candidate_${number}`;

/** A question Jev did not answer counts as 0: unsure leads to clarify or no competency, never a wrong one. */
const scoreOf = (answers: Record<string, unknown>, key: string): number =>
  noulScoreOf(answers[key]) ?? 0;

/** The option with the highest score; ties go to the first, so homework wins a tie. */
function best<T>([first, ...rest]: readonly [T, ...T[]], score: (option: T) => number) {
  return rest.reduce(
    (top, value) => {
      const confidence = score(value);
      return confidence > top.confidence ? { value, confidence } : top;
    },
    { value: first, confidence: score(first) },
  );
}

/**
 * Builds the raw classification from Jev's scores. It is still unchecked: a score outside 0 to 1
 * passes through and the validator rejects the whole output. Only a non-homework message gets no
 * topic, so a sure small-talk answer is not rejected as inconsistent.
 */
function classificationOf(
  answers: Record<string, unknown>,
  candidates: readonly CurriculumCompetency[],
) {
  const intent = best(CHILD_MESSAGE_INTENTS, (value) => scoreOf(answers, intentKey(value)));
  const subject = best(HINT_SUBJECTS, (value) => scoreOf(answers, subjectKey(value)));
  const [first, ...rest] = candidates.map(({ code }, index) => ({ code, number: index + 1 }));
  const topic =
    first === undefined
      ? undefined
      : best([first, ...rest], ({ number }) => scoreOf(answers, candidateKey(number)));
  const hasTopic = intent.value === 'homework' && topic !== undefined && topic.confidence > 0;
  return {
    version: TOPIC_CLASSIFICATION_VERSION,
    intent,
    subject: subject.confidence > 0 ? subject : null,
    topic: hasTopic
      ? { kind: 'competency', competencyCode: topic.value.code, confidence: topic.confidence }
      : { kind: 'none' },
  };
}

/**
 * TypeSafe's Jev decision model as the topic classifier (#92): one `systemone` request with one
 * yes/no question per intent, subject and candidate competency, answered as probabilities. The
 * state is a JSON object of the child's message and the numbered candidate descriptions. Jev can
 * only point at a candidate number, so it can never name a competency outside the candidates. It
 * cannot propose an open label; that needs a text model (issue #92, step 12).
 */
export class JevTopicClassifier implements TopicClassifier {
  readonly name = 'jev';

  constructor(private readonly options: JevOptions) {}

  classify({
    task,
    candidates,
  }: TopicClassificationRequest): ResultAsync<unknown, HintProviderFailure> {
    const offered = candidates.slice(0, MAX_CANDIDATES);
    const state = JSON.stringify({
      message: task,
      candidates: offered.map(({ description }, index) => ({ number: index + 1, description })),
    });
    const questions: Readonly<Record<string, string>> = Object.fromEntries<string>([
      ...CHILD_MESSAGE_INTENTS.map((intent): [string, string] => [
        intentKey(intent),
        INTENT_QUESTIONS[intent],
      ]),
      ...HINT_SUBJECTS.map((subject): [string, string] => [
        subjectKey(subject),
        SUBJECT_QUESTIONS[subject],
      ]),
      ...offered.map((_, index): [string, string] => [
        candidateKey(index + 1),
        candidateQuestion(index + 1),
      ]),
    ]);
    return ResultAsync.fromSafePromise(askJev(this.options, { state, questions })).andThen(
      (answers) => answers.map((scores) => classificationOf(scores, offered)),
    );
  }
}
