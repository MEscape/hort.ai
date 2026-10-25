import type { Actor } from '@modules/auth';

import type { RateLimitedAppError, ValidationAppError } from '@lib/errors';
import type { RateLimitPolicy } from '@lib/rate-limit';
import type { AppResult, AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/guidance-errors';
import { parseChildTaskText } from '../../domain/models/child-task-text';
import { parseHintSubject } from '../../domain/models/hint-subject';
import { parseChildProfileId } from '../../domain/models/ids';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { HintLevel } from '../../domain/models/hint-level';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { ChildProfileId } from '../../domain/models/ids';
import type {
  ChildProfileAccessError,
  OwnChildProfile,
} from '../../domain/ports/child-profile-access.port';
import type { RequestHintInput } from '../contracts/hint-inputs';
import type { ChildTaskDependencies } from '../guidance-dependencies';

/** The checked fields every request about one child's task carries. */
export interface ParsedChildTask {
  readonly id: ChildProfileId;
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
}

/** A task of one of the actor's own children, admitted within the child's budget. */
export interface AdmittedChildTask {
  readonly child: OwnChildProfile;
  readonly task: ChildTaskText;
  readonly subject: HintSubject;
}

/** The cheap input checks, before anything is looked up or counted. */
export function parseChildTask(
  input: Pick<RequestHintInput, 'childProfileId' | 'task' | 'subject'>,
): AppResult<ParsedChildTask, ValidationAppError> {
  return parseChildProfileId(input.childProfileId).andThen((id) =>
    parseChildTaskText(input.task).andThen((task) =>
      parseHintSubject(input.subject).map((subject) => ({ id, task, subject })),
    ),
  );
}

/**
 * The child must be the actor's own (another parent's child is "not found"), and each request
 * spends one of that child's budget under `policy`. Counted per child, so siblings do not use up
 * each other's help.
 */
export function admitOwnChild(
  { childProfiles, rateLimiter }: Pick<ChildTaskDependencies, 'childProfiles' | 'rateLimiter'>,
  {
    actor,
    parsed: { id, task, subject },
    policy,
  }: { readonly actor: Actor; readonly parsed: ParsedChildTask; readonly policy: RateLimitPolicy },
): AppResultAsync<AdmittedChildTask, ChildProfileAccessError | RateLimitedAppError> {
  return childProfiles.findOwn(id).andThen((child) =>
    rateLimiter
      .enforce({
        policy,
        subject: { kind: 'identifier', value: `child-profile:${actor.tenantId}:${child.id}` },
      })
      .mapErr(fromRateLimitFailure)
      .map(() => ({ child, task, subject })),
  );
}

/**
 * The competencies of the child's own state and grade (#28). Without them the AI's text is less
 * specific, not wrong, so a failed retrieval is logged and the request goes ahead ungrounded.
 */
export async function groundInCurriculum(
  { competencies, audit }: Pick<ChildTaskDependencies, 'competencies' | 'audit'>,
  { child, task, subject }: AdmittedChildTask,
  level: HintLevel,
): Promise<readonly CurriculumCompetency[]> {
  const found = await competencies.findFor({
    federalState: child.federalState,
    grade: child.grade,
    subject,
    task,
  });
  if (found.isErr()) {
    audit.record({ type: 'guidance.grounding_unavailable', level, code: found.error.code });
    return [];
  }
  return found.value;
}
