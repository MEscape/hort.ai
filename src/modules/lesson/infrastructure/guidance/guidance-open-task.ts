import { getHelpSessionQueries, readMath } from '@modules/guidance';

import { toHelpSessionId } from '../../domain/models/ids';

import type { OpenTaskPort } from '../../domain/ports/open-task.port';

/**
 * Asks the guidance module, through its public API, for the child's open session (it authorizes
 * the signed-in parent itself) and reads the task's math with the same reader the solution-leak
 * guard uses, so the scene and the guard see the same numbers.
 */
export function createGuidanceOpenTask(
  queries: Pick<
    ReturnType<typeof getHelpSessionQueries>,
    'getOpenHelpSession'
  > = getHelpSessionQueries(),
): OpenTaskPort {
  return {
    openTask: (childProfileId) =>
      queries.getOpenHelpSession
        .execute({ childProfileId })
        .map((session) =>
          session === null
            ? null
            : { sessionId: toHelpSessionId(session.sessionId), task: session.task },
        ),
    readMath,
  };
}
