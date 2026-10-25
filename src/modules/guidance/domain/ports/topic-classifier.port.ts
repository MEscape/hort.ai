import type { WorldArea } from '@modules/world';

import type { ResultAsync } from '@lib/result';

import type { HintProviderFailure } from './hint-provider.port';
import type { ChildTaskText } from '../models/child-task-text';
import type { CurriculumCompetency } from '../models/hint-request';
import type { HintSubject } from '../models/hint-subject';

/**
 * What a topic classifier is given (#92). All of it is data: the child's text and the candidate
 * competencies never become part of a classifier's instructions.
 */
export interface TopicClassificationRequest {
  readonly task: ChildTaskText;
  /** The subject the child picked. */
  readonly subject: HintSubject;
  /** The competencies `findRelevantCompetencies` returned for the child's own state and grade (at most five). */
  readonly candidates: readonly CurriculumCompetency[];
  /**
   * The islands of the world the task may belong to (`areasForSchoolSubject`); empty when the child
   * picked one. Their English topics are trusted data, never the child's words.
   */
  readonly areas: ReadonlyArray<Pick<WorldArea, 'id' | 'topics'>>;
}

/** Which model classified; stored with the session (#17) next to `fallback`. */
export type TopicClassifierName = 'jev';

/**
 * A model that sorts the child's message into intent, subject and topic. Its answer is untrusted, so
 * it is returned as `unknown` and only used after `validateTopicClassification`. An adapter MUST
 * settle within its configured timeout and report a missed deadline as `timeout`.
 */
export interface TopicClassifier {
  readonly name: TopicClassifierName;
  classify(request: TopicClassificationRequest): ResultAsync<unknown, HintProviderFailure>;
}
