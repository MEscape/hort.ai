import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { readMath } from '@modules/guidance/domain/solution-leak/read-math';
import type { LessonDependencies } from '@modules/lesson/application/lesson-dependencies';
import { toHelpSessionId } from '@modules/lesson/domain/models/ids';
import type { ChildAccessPort } from '@modules/lesson/domain/ports/child-access.port';
import type { OpenTask, OpenTaskPort } from '@modules/lesson/domain/ports/open-task.port';
import { guidanceChildSafety } from '@modules/lesson/infrastructure/safety/guidance-child-safety';

import { okAsync } from '@lib/result';

import { parent, recordingAudit, signedInAs } from '../auth/fakes';

export const CHILD_ID = 'child-1';

/** The learner module's answer for the signed-in parent: these are their children, no others. */
export function ownsChildren(...ids: string[]): ChildAccessPort {
  return { ownsChild: (id) => okAsync(ids.includes(id)) };
}

/** The guidance module's answer: this child's open task, or none. */
export function openTask(
  open: { readonly sessionId: string; readonly task: string } | null = null,
): OpenTaskPort {
  const task: OpenTask | null =
    open === null ? null : { sessionId: toHelpSessionId(open.sessionId), task: open.task };
  return { openTask: () => okAsync(task), readMath };
}

export function build({
  actor = parent(),
  children = ownsChildren(CHILD_ID),
  tasks = openTask(),
}: { actor?: Actor; children?: ChildAccessPort; tasks?: OpenTaskPort } = {}): LessonDependencies {
  return {
    authorization: createAuthorizationService({
      currentActor: signedInAs(actor),
      audit: recordingAudit(),
    }),
    children,
    safety: guidanceChildSafety,
    tasks,
  };
}
