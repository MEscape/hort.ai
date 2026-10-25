import { toSessionTopic } from '../../domain/topic/session-topic';

import { classifyTopic } from './classify-topic';

import type { ChildTaskText } from '../../domain/models/child-task-text';
import type { HelpSession } from '../../domain/models/help-session';
import type { HintSubject } from '../../domain/models/hint-subject';
import type { OwnChildProfile } from '../../domain/ports/child-profile-access.port';
import type { SessionTopic } from '../../domain/topic/session-topic';
import type { HelpSessionDependencies } from '../help-session-dependencies';

/**
 * Classifies the task of a new session (#92) against the candidates of the child's own curriculum.
 * When the open session it replaces asked to clarify, the new task is the child's reply (the task
 * with the explanation added), so it is classified once more and never asked about again. A failed
 * retrieval only means no competency can be picked: the intent is still classified.
 */
export async function classifySessionTask(
  { competencies, classifier, audit }: HelpSessionDependencies,
  {
    child,
    task,
    subject,
    replaces,
  }: {
    readonly child: OwnChildProfile;
    readonly task: ChildTaskText;
    readonly subject: HintSubject;
    readonly replaces: HelpSession | null;
  },
): Promise<SessionTopic> {
  const candidates = await competencies
    .findFor({ federalState: child.federalState, grade: child.grade, subject, task })
    .match(
      (found) => found,
      (failure) => {
        // The session opens on the first rung, which is what a grounding failure is logged under.
        audit.record({
          type: 'guidance.grounding_unavailable',
          level: 'understand_task',
          code: failure.code,
        });
        return [];
      },
    );
  const classified = await classifyTopic(
    { audit, ...(classifier === undefined ? {} : { classifier }) },
    {
      task,
      subject,
      candidates,
      clarificationAlreadyAsked: replaces?.topic.opening?.kind === 'clarify',
    },
  );
  return toSessionTopic(classified);
}
