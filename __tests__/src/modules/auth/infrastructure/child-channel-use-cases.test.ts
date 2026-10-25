import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import {
  runInChildChannel,
  withChildChannelScope,
} from '@modules/auth/infrastructure/channel/child-channel-scope';
import { SaveControls } from '@modules/learner/application/commands/save-controls';
import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';
import { GetOnboardingState } from '@modules/learner/application/queries/get-onboarding-state';
import { AwardLearningXp } from '@modules/progression/application/commands/award-learning-xp';
import { ClaimDailyReward } from '@modules/progression/application/commands/claim-daily-reward';
import { GetProgress } from '@modules/progression/application/queries/get-progress';
import { createLearnerChildAccess } from '@modules/progression/infrastructure/children/learner-child-access';

import { unauthorizedError } from '@lib/errors';

import { build as buildLearner, setupDoneProfile } from '../../learner/fakes';
import { build as buildProgression } from '../../progression/fakes';
import { TENANT, failingWith, recordingAudit } from '../fakes';

/**
 * The child channel through the REAL learner and progression use cases (in-memory stores): the
 * guardian `parent-1` has two children, the channel is bound to `own` only.
 */
const binding = {
  channel: 'alexa',
  guardianId: 'parent-1',
  childProfileId: 'own',
  tenantId: TENANT,
} as const;

function channelWorld() {
  const securityAudit = recordingAudit();
  const authorization = createAuthorizationService({
    currentActor: withChildChannelScope(
      failingWith(unauthorizedError('auth.no_session', 'No session.')),
    ),
    audit: securityAudit,
  });
  const learner = buildLearner(
    undefined,
    setupDoneProfile({ id: 'own' }),
    setupDoneProfile({ id: 'sibling' }),
  );
  const learnerDeps = { ...learner.deps, authorization };
  const getChildProfileById = new GetChildProfileById(learnerDeps);
  const progression = buildProgression(undefined, []);
  const progressionDeps = {
    ...progression.deps,
    authorization,
    children: createLearnerChildAccess({ getChildProfileById }),
  };
  return {
    securityAudit,
    progressionAudit: progression.audit,
    getChildProfileById,
    getOnboardingState: new GetOnboardingState(learnerDeps),
    saveControls: new SaveControls(learnerDeps),
    claimDailyReward: new ClaimDailyReward(progressionDeps),
    awardLearningXp: new AwardLearningXp(progressionDeps),
    getProgress: new GetProgress(progressionDeps),
  };
}

const inChannel = <T>(work: () => Promise<T>) => runInChildChannel(binding, work);

describe('child channel through the real use cases', () => {
  it('reads the bound child, its progress, and claims its daily reward', async () => {
    const world = channelWorld();

    const [profile, progress, claim] = await inChannel(async () => [
      await world.getChildProfileById.execute('own'),
      await world.getProgress.execute({ childProfileId: 'own' }),
      await world.claimDailyReward.execute({ childProfileId: 'own' }),
    ]);

    expect(profile._unsafeUnwrap().id).toBe('own');
    expect(progress.isOk()).toBe(true);
    expect(claim._unsafeUnwrap().outcome).toBe('granted');
  });

  it('is refused the sibling profile, its progress and its reward', async () => {
    const world = channelWorld();

    const results = await inChannel(async () => [
      await world.getChildProfileById.execute('sibling'),
      await world.getProgress.execute({ childProfileId: 'sibling' }),
      await world.claimDailyReward.execute({ childProfileId: 'sibling' }),
    ]);

    for (const result of results) {
      expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    }
    expect(world.securityAudit.events.map((event) => event.type)).toContain('authorization.denied');
  });

  it('is refused the parent operations: onboarding state of all profiles, settings', async () => {
    const world = channelWorld();

    const [onboarding, settings] = await inChannel(async () => [
      await world.getOnboardingState.execute(),
      await world.saveControls.execute({
        profileId: 'own',
        voiceEnabled: true,
        dailyLimitMinutes: null,
        allowedWindow: null,
        learningInsights: false,
        guardianConfirmed: true,
      } as never),
    ]);

    expect(onboarding._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(settings._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('is refused learning XP for the bound child: only the daily reward is its to write', async () => {
    const world = channelWorld();

    const xp = await inChannel(() =>
      Promise.resolve(
        world.awardLearningXp.execute({
          childProfileId: 'own',
          event: 'help_session_completed',
          eventKey: 'session-1',
        }),
      ),
    );

    expect(xp._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('names the channel, not the guardian, as the actor of the audit events', async () => {
    const world = channelWorld();

    await inChannel(async () => {
      await world.claimDailyReward.execute({ childProfileId: 'own' });
      await world.getChildProfileById.execute('sibling');
    });

    const claimed = world.progressionAudit.events[0];
    const denied = world.securityAudit.events.find(
      (event) => event.type === 'authorization.denied',
    );
    for (const event of [claimed, denied]) {
      expect(event).toMatchObject({ channel: 'alexa', onBehalfOf: 'parent-1' });
      expect(event).not.toHaveProperty('actorId');
    }
  });
});
