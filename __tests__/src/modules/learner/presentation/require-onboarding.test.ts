import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEARNER_ERROR_CODES } from '@modules/learner/application/contracts/learner-constraints';
import {
  requireChildWelcome,
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
  welcomeCompletedAt: null,
};

const WELCOMED = {
  ...PROFILE,
  setupStep: 'done',
  setupCompletedAt: new Date(),
  welcomeCompletedAt: new Date('2026-10-25T08:00:00.000Z'),
};
const SETUP_DONE = { ...WELCOMED, welcomeCompletedAt: null };

describe('onboarding page guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a finished parent into the home and sends an unfinished one into onboarding', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: WELCOMED }));
    await expect(requireOnboarded()).resolves.toMatchObject({ id: 'p1', tutorId: 'max' });

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
        welcomeCompletedAt: null,
      },
    });
  });

  it('never shows onboarding again once finished', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: WELCOMED }));
    await expect(requireOnboarding()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith({ href: '/home', locale: 'de' });
  });

  it('sends a parent whose child has not done the welcome yet from the home to /hello', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: SETUP_DONE }));
    await expect(requireOnboarded()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenCalledWith({ href: '/hello', locale: 'de' });
  });

  it('lets the welcome page through only while the setup is done and the welcome is open', async () => {
    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: SETUP_DONE }));
    await expect(requireChildWelcome()).resolves.toMatchObject({
      id: 'p1',
      welcomeCompletedAt: null,
    });
    expect(redirect).not.toHaveBeenCalled();

    execute.mockReturnValueOnce(okAsync({ step: 'review', profile: PROFILE }));
    await expect(requireChildWelcome()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenLastCalledWith({ href: '/onboarding', locale: 'de' });

    execute.mockReturnValueOnce(okAsync({ step: 'child', profile: null }));
    await expect(requireChildWelcome()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenLastCalledWith({ href: '/onboarding', locale: 'de' });

    execute.mockReturnValueOnce(okAsync({ step: 'done', profile: WELCOMED }));
    await expect(requireChildWelcome()).rejects.toThrow('redirect');
    expect(redirect).toHaveBeenLastCalledWith({ href: '/home', locale: 'de' });
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
    await expect(requireChildWelcome()).rejects.toThrow('learner.persistence_failed');
    expect(redirect).not.toHaveBeenCalled();
  });
});
