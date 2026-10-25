import 'server-only';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { once } from '@lib/utils';

import { AdoptClassroomSettings } from './application/commands/adopt-classroom-settings';
import { ChooseTutor } from './application/commands/choose-tutor';
import { CompleteSetup } from './application/commands/complete-setup';
import { CreateChildProfile } from './application/commands/create-child-profile';
import { ResetOnboarding } from './application/commands/reset-onboarding';
import { SaveControls } from './application/commands/save-controls';
import { SaveInterests } from './application/commands/save-interests';
import { GetChildProfileById } from './application/queries/get-child-profile-by-id';
import { GetOnboardingState } from './application/queries/get-onboarding-state';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerLearnerAuditLog,
} from './infrastructure/audit/logger-learner-audit-log';
import { PrismaChildProfileRepository } from './infrastructure/prisma/prisma-child-profile.repository';
import { createCatalogTutors } from './infrastructure/tutors/catalog-tutor-catalog';

import type { LearnerDependencies } from './application/learner-dependencies';

/**
 * The module's composition root: the one file that knows both the use cases and their adapters,
 * and the only place the auth and audit modules are wired in. `server-only` makes an accidental
 * import from a Client Component a build error. Built lazily, so importing it during `next build`
 * needs no configuration.
 *
 * The audit port writes its log lines and, through the audit module, the durable trail entries the
 * policy keeps. The trail write is best-effort and never throws.
 */
/**
 * The onboarding reset exists to rerun the setup while developing; the validated server config
 * decides, so production never offers it (the use case refuses there as well).
 */
export const isDevResetAvailable = (): boolean => serverEnv.NODE_ENV !== 'production';

const getDependencies = once((): LearnerDependencies => ({
  authorization: getAccessControl(),
  childProfiles: new PrismaChildProfileRepository(),
  audit: withAuditTrail(loggerLearnerAuditLog, {
    source: 'learner',
    levels: LEVEL_BY_EVENT,
    policy: TRAIL_BY_EVENT,
  }),
  tutors: createCatalogTutors(),
  isDevResetAllowed: isDevResetAvailable(),
  clock: systemClock,
}));

export const getLearnerCommands = once(() => {
  const dependencies = getDependencies();
  return {
    createChildProfile: new CreateChildProfile(dependencies),
    saveInterests: new SaveInterests(dependencies),
    chooseTutor: new ChooseTutor(dependencies),
    saveControls: new SaveControls(dependencies),
    completeSetup: new CompleteSetup(dependencies),
    adoptClassroomSettings: new AdoptClassroomSettings(dependencies),
    resetOnboarding: new ResetOnboarding(dependencies),
  };
});

export const getLearnerQueries = once(() => {
  const dependencies = getDependencies();
  return {
    getOnboardingState: new GetOnboardingState(dependencies),
    getChildProfileById: new GetChildProfileById(dependencies),
  };
});
