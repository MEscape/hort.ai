import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  alreadyOnboarded,
  childProfileNotFound,
} from '@modules/learner/domain/errors/learner-errors';
import { chooseTutorAction } from '@modules/learner/presentation/actions/choose-tutor-action';
import { completeSetupAction } from '@modules/learner/presentation/actions/complete-setup-action';
import { createChildProfileAction } from '@modules/learner/presentation/actions/create-child-profile-action';
import { saveControlsAction } from '@modules/learner/presentation/actions/save-controls-action';
import { saveInterestsAction } from '@modules/learner/presentation/actions/save-interests-action';

import { errAsync, okAsync } from '@lib/result';

const commands = vi.hoisted(() => ({
  createChildProfile: { execute: vi.fn() },
  saveInterests: { execute: vi.fn() },
  chooseTutor: { execute: vi.fn() },
  saveControls: { execute: vi.fn() },
  completeSetup: { execute: vi.fn() },
}));
vi.mock('@modules/learner/composition', () => ({ getLearnerCommands: () => commands }));

const VIEW = {
  id: 'profile-1',
  displayName: 'Lisa',
  federalState: 'HE',
  grade: 3,
  interests: ['nature'],
  tutorId: 'max',
  controls: {
    voiceEnabled: false,
    dailyLimitMinutes: null,
    allowedWindow: null,
    learningInsights: false,
  },
  guardianConfirmed: true,
  setupStep: 'review',
  setupCompletedAt: null,
};

const CONTROLS = {
  profileId: 'profile-1',
  voiceEnabled: true,
  dailyLimitMinutes: '30',
  windowEnabled: true,
  windowFrom: '900',
  windowUntil: '1080',
  learningInsights: false,
  guardianConfirmed: true,
};

describe('learner Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const command of Object.values(commands)) {
      command.execute.mockReset();
    }
  });

  it('refuses malformed input before reaching any use case', async () => {
    const results = await Promise.all([
      createChildProfileAction({ displayName: '  ', federalState: 'XX', grade: '9' }),
      saveInterestsAction({ profileId: 'p', interests: ['nature', 'nope'] }),
      saveInterestsAction({
        profileId: 'p',
        interests: ['nature', 'animals', 'art', 'music', 'sports'],
      }),
      chooseTutorAction({ profileId: 'p', tutorId: '' }),
      saveControlsAction({ ...CONTROLS, guardianConfirmed: false }),
      saveControlsAction({ ...CONTROLS, windowUntil: '915' }),
      saveControlsAction({ ...CONTROLS, dailyLimitMinutes: '31' }),
      completeSetupAction({ profileId: '' }),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.fieldErrors).toBeDefined();
      }
    }
    for (const command of Object.values(commands)) {
      expect(command.execute).not.toHaveBeenCalled();
    }
  });

  it('trims the name, turns the grade into a number and returns a plain profile', async () => {
    commands.createChildProfile.execute.mockReturnValue(okAsync(VIEW));
    const result = await createChildProfileAction({
      displayName: ' Lisa ',
      federalState: 'HE',
      grade: '3',
      ownerId: 'someone-else',
    });
    expect(commands.createChildProfile.execute).toHaveBeenCalledWith({
      displayName: 'Lisa',
      federalState: 'HE',
      grade: 3,
    });
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({ id: 'profile-1', tutorId: 'max', voiceEnabled: false }),
    });
    expect(JSON.stringify(result)).not.toContain('setupCompletedAt');
  });

  it('passes the interests and the companion for the signed-in parent’s profile only', async () => {
    commands.saveInterests.execute.mockReturnValue(okAsync(VIEW));
    commands.chooseTutor.execute.mockReturnValue(okAsync(VIEW));
    await saveInterestsAction({ profileId: 'profile-1', interests: ['nature', 'sports'] });
    await chooseTutorAction({ profileId: 'profile-1', tutorId: 'max', ownerId: 'x' });
    expect(commands.saveInterests.execute).toHaveBeenCalledWith({
      profileId: 'profile-1',
      interests: ['nature', 'sports'],
    });
    expect(commands.chooseTutor.execute).toHaveBeenCalledWith({
      profileId: 'profile-1',
      tutorId: 'max',
    });
  });

  it('turns the controls form into the use case input and always sends the confirmation as given', async () => {
    commands.saveControls.execute.mockReturnValue(okAsync(VIEW));
    await saveControlsAction(CONTROLS);
    await saveControlsAction({ ...CONTROLS, dailyLimitMinutes: 'none', windowEnabled: false });
    expect(commands.saveControls.execute).toHaveBeenNthCalledWith(1, {
      profileId: 'profile-1',
      voiceEnabled: true,
      dailyLimitMinutes: 30,
      allowedWindow: { fromMinute: 900, untilMinute: 1080 },
      learningInsights: false,
      guardianConfirmed: true,
    });
    expect(commands.saveControls.execute).toHaveBeenNthCalledWith(2, {
      profileId: 'profile-1',
      voiceEnabled: true,
      dailyLimitMinutes: null,
      allowedWindow: null,
      learningInsights: false,
      guardianConfirmed: true,
    });
  });

  it('reports a refusal by code, with no success data', async () => {
    commands.completeSetup.execute.mockReturnValue(errAsync(childProfileNotFound()));
    commands.createChildProfile.execute.mockReturnValue(errAsync(alreadyOnboarded()));
    const completed = await completeSetupAction({ profileId: 'other' });
    const created = await createChildProfileAction({
      displayName: 'Lisa',
      federalState: 'HE',
      grade: '3',
    });
    expect(completed).toMatchObject({ ok: false, error: { code: 'learner.not_found' } });
    expect(created).toMatchObject({ ok: false, error: { code: 'learner.already_onboarded' } });
  });
});
