import { INTEREST_TOPICS } from './interest-icons';

import type { TutorOption } from './tutor-option';
import type { Interest } from '../../application/contracts/learner-constraints';

/** The interests of the child that a companion likes too. */
function sharedInterests(tutor: TutorOption, interests: readonly string[]): Interest[] {
  return (interests as Interest[]).filter((interest) =>
    INTEREST_TOPICS[interest].some((topic) => tutor.topics.includes(topic)),
  );
}

/**
 * Which companions fit the child best: those that share the most interests, and only when that is at
 * least one. The result maps a companion's id to the shared interests; companions that fit less, or
 * not at all, are absent. A recommendation, never a choice: nothing is preselected from it.
 */
export function bestFits(
  tutors: readonly TutorOption[],
  interests: readonly string[],
): ReadonlyMap<string, readonly Interest[]> {
  const shared = tutors.map((tutor) => [tutor.id, sharedInterests(tutor, interests)] as const);
  const best = Math.max(0, ...shared.map(([, list]) => list.length));
  return new Map(shared.filter(([, list]) => best > 0 && list.length === best));
}
