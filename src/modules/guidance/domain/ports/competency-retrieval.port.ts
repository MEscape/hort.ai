import type { AppResultAsync } from '@lib/result';

import type { ChildTaskText } from '../models/child-task-text';
import type { CurriculumCompetency } from '../models/hint-request';
import type { HintSubject } from '../models/hint-subject';

/** What grounds a hint: the child's own state and grade, taken from their profile, never the request. */
export interface CompetencyQuery {
  readonly federalState: string;
  readonly grade: number;
  readonly subject: HintSubject;
  readonly task: ChildTaskText;
}

/**
 * The curriculum competencies relevant to a child's task (#28). Their text is untrusted data and
 * only ever enters the prompt's data block (`buildHintPrompt`).
 */
export interface CompetencyRetrieval {
  findFor(query: CompetencyQuery): AppResultAsync<readonly CurriculumCompetency[]>;
}
