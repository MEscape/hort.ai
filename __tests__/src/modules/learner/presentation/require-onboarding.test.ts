import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEARNER_ERROR_CODES } from '@modules/learner/application/contracts/learner-constraints';
import {
  requireOnboarded,
  requireOnboarding,
} from '@modules/learner/presentation/guards/require-onboarding';

import { redirect } from '@i18n';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@modules/learner/composition', () => ({
  getLearnerQueries: () => ({ getOnboardingState: { execute } }),
}));
vi.mock('@i18n', () => ({
  redirect: vi.fn(() => {
    throw new Error('redirect');
  }),
}));
vi.mock('@i18n/server', () => ({ getLocale: () => Promise.resolve('de') }));

const PROFILE = {
  id: 'p1',
  displayName: 'Lisa',
  federalState: 'HE',
  grade: 3,
  interests: ['nature'],
  tutorId: 'max',
  controls: {
    voiceEnabled: true,
    dailyLimitMinutes: 30,
    allowedWindow: { fromMinute: 900, untilMinute: 1080 },
    learningInsights: false,
  },
  guardianConfirmed: true,
  setupStep: 'controls',
  setupCompletedAt: null,
};

describe('onboarding page guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a finished parent into the home with their child, and sends an unfinished one into onboarding', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: PROFILE }));
    await expect(requireOnboarded()).resolves.toMatchObject({
      step: 'done',
      profile: { id: PROFILE.id },
    });

    execute.mockReturnValueOnce(okAsync({ step: 'child', profile: null }));
    await expect(requireOnboarded()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith({ href: '/onboarding', locale: 'de' });
  });

  it('resumes where the backend says, with every choice as plain values', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'controls', profile: PROFILE }));
    expect(await requireOnboarding()).toEqual({
      step: 'controls',
      profile: {
        id: 'p1',
        displayName: 'Lisa',
        federalState: 'HE',
        grade: 3,
        interests: ['nature'],
        tutorId: 'max',
        voiceEnabled: true,
        dailyLimitMinutes: 30,
        allowedWindow: { fromMinute: 900, untilMinute: 1080 },
        learningInsights: false,
        guardianConfirmed: true,
      },
    });
  });

  it('never shows onboarding again once finished', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: PROFILE }));
    await expect(requireOnboarding()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith({ href: '/home', locale: 'de' });
  });

  it('sends a backend failure to the error boundary rather than a redirect loop', async () => {
    execute.mockReturnValue(
      errAsync(
        infrastructureError(
          LEARNER_ERROR_CODES.persistenceFailed,
          'The profile could not be read.',
        ),
      ),
    );
    await expect(requireOnboarded()).rejects.toThrow('learner.persistence_failed');
    await expect(requireOnboarding()).rejects.toThrow('learner.persistence_failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
