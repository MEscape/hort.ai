import 'server-only';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { once } from '@lib/utils';

import { AwardLearningXp } from './application/commands/award-learning-xp';
import { ClaimDailyReward } from './application/commands/claim-daily-reward';
import { GetProgress } from './application/queries/get-progress';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerProgressionAuditLog,
} from './infrastructure/audit/logger-progression-audit-log';
import { createLearnerChildAccess } from './infrastructure/children/learner-child-access';
import { PrismaProgressEventRepository } from './infrastructure/prisma/prisma-progress-event.repository';

import type { ProgressionDependencies } from './application/progression-dependencies';

/**
 * The module's composition root: the one file that knows both the use cases and their adapters,
 * and the only place the auth, audit and learner modules are wired in. `server-only` makes an
 * accidental import from a Client Component a build error. Built lazily, so importing it during
 * `next build` needs no configuration.
 *
 * Ownership of a child is asked of the learner module, through its public API only.
 */
const getDependencies = once((): ProgressionDependencies => ({
  authorization: getAccessControl(),
  progress: new PrismaProgressEventRepository(),
  children: createLearnerChildAccess(),
  audit: withAuditTrail(loggerProgressionAuditLog, {
    source: 'progression',
    levels: LEVEL_BY_EVENT,
    policy: TRAIL_BY_EVENT,
  }),
  clock: systemClock,
}));

export const getProgressionCommands = once(() => {
  const dependencies = getDependencies();
  return {
    claimDailyReward: new ClaimDailyReward(dependencies),
    awardLearningXp: new AwardLearningXp(dependencies),
  };
});

export const getProgressionQueries = once(() => ({
  getProgress: new GetProgress(getDependencies()),
}));
