import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { levelOf } from '../../domain/models/level';

import { readProgress } from './read-progress';

import type { ProgressContext } from './read-progress';
import type { ProgressEventKind } from '../../domain/models/progress';
import type { ProgressView } from '../contracts/progression-views';
import type { ProgressionDependencies } from '../progression-dependencies';

export interface Grant {
  readonly kind: ProgressEventKind;
  readonly eventKey: string;
  readonly xp: number;
}

export interface GrantResult {
  /** Whether THIS call stored the reward (`false`: the key was stored before). */
  readonly stored: boolean;
  /** Whether this call moved the child up a level. */
  readonly leveledUp: boolean;
  readonly progress: ProgressView;
}

/**
 * Stores one reward through the idempotent insert, then reads the progress back. The level before
 * is the level of the total minus this reward, so no second read is needed. A repeat stores nothing
 * and reports the unchanged progress.
 */
export function grantXp(
  deps: ProgressionDependencies,
  context: ProgressContext,
  grant: Grant,
): AppResultAsync<GrantResult, InfrastructureAppError> {
  const { actor, childProfileId, now } = context;
  return deps.progress
    .insertOnce(
      { tenantId: actor.tenantId, ownerId: actor.id },
      { childProfileId, ...grant, occurredAt: now },
    )
    .andThen((stored) =>
      readProgress(deps, context).map((progress) => ({
        stored,
        leveledUp: stored && levelOf(progress.xp - grant.xp).level < progress.level,
        progress,
      })),
    );
}
