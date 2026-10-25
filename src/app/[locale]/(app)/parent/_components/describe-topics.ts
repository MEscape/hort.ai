import { curriculumQueries } from '@modules/curriculum';
import type { ParentTopics } from '@modules/learner';

import { isDefined } from '@lib/utils';

import { orFail } from '@/app/_lib/or-fail';

/**
 * The curriculum module's own wording for the tasks' curriculum codes. Composed here because the
 * learner module may not depend on curriculum (curriculum already reaches learner through
 * classroom). An unknown or teacher-material code is simply absent, so its task shows no topic.
 */
export async function describeTopics(codes: ReadonlyArray<string | null>): Promise<ParentTopics> {
  const described = await orFail(
    curriculumQueries.describeCompetencies.execute(codes.filter(isDefined)),
  );
  // The curriculum describes a competency by its statement; a topic is named by that.
  return Object.fromEntries(
    described.map(({ code, text }) => [code, { section: null, statement: text }]),
  );
}
