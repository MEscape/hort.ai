import { islandTopic } from '@modules/world';

import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { GUIDANCE_VALIDATION_CODES, guidanceFieldInvalid } from '../errors/guidance-errors';

/** The world island (and place on it) the child started a task from. */
export interface SessionIsland {
  readonly areaId: string;
  readonly placeId: string | null;
}

/**
 * The island of a start request, checked against the world: no island at all is fine, but an id
 * that is not an island, a place of another island or a place without an island is refused.
 */
export function parseSessionIsland(
  areaId: string | undefined,
  placeId: string | undefined,
): AppResult<SessionIsland | null, ValidationAppError> {
  if (areaId === undefined && placeId === undefined) {
    return ok(null);
  }
  const topic = islandTopic(areaId, placeId);
  return topic === null
    ? err(guidanceFieldInvalid('areaId', GUIDANCE_VALIDATION_CODES.areaInvalid))
    : ok({ areaId: topic.areaId, placeId: topic.placeId });
}
