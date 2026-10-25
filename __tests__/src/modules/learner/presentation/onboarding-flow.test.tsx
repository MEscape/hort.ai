import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VOICE_NOTICE_VERSION } from '@modules/learner/application/contracts/learner-constraints';
import { chooseTutorAction } from '@modules/learner/presentation/actions/choose-tutor-action';
import { completeSetupAction } from '@modules/learner/presentation/actions/complete-setup-action';
import { createChildProfileAction } from '@modules/learner/presentation/actions/create-child-profile-action';
import { saveControlsAction } from '@modules/learner/presentation/actions/save-controls-action';
import { saveInterestsAction } from '@modules/learner/presentation/actions/save-interests-action';
import { OnboardingFlow } from '@modules/learner/presentation/components/onboarding-flow';
import type { ChildProfileDto } from '@modules/learner/presentation/dto/learner-dto';
import en from '@modules/learner/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

import app from '@/i18n/messages/en.json';

// The first render of the whole flow loads zod, react-hook-form and the icons; give it room on a busy machine.
configure({ asyncUtilTimeout: 5000 });

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ replace }),
}));
vi.mock('@modules/learner/presentation/actions/create-child-profile-action', () => ({
  createChildProfileAction: vi.fn(),
}));
vi.mock('@modules/learner/presentation/actions/save-interests-action', () => ({
  saveInterestsAction: vi.fn(),
}));
vi.mock('@modules/learner/presentation/actions/choose-tutor-action', () => ({
  chooseTutorAction: vi.fn(),
}));
vi.mock('@modules/learner/presentation/actions/save-controls-action', () => ({
  saveControlsAction: vi.fn(),
}));
vi.mock('@modules/learner/presentation/actions/complete-setup-action', () => ({
  completeSetupAction: vi.fn(),
}));

const TUTORS = [
  {
    id: 'max',
    name: 'Max',
    animal: 'Hund',
    description: 'Treuer, sportlicher Hund.',
    traits: ['treu', 'ermutigend'],
    topics: ['Sport', 'Natur', 'Mathe'],
    greeting: 'Wuff, hallo! Ich bin Max.',
    voice: 'freundlich, kräftig',
    imageUrl: '',
    imageOpenUrl: '',
    introUrl: 'https://storage.test/tutors/x/vorstellung.mp3',
    tone: 'sky' as const,
  },
  {
    id: 'lili',
    name: 'Lili',
    animal: 'Hase',
    description: 'Ruhige, geduldige Häsin.',
    traits: ['geduldig', 'sanft'],
    topics: ['Deutsch', 'Lesen', 'Tiere'],
    greeting: 'Hallo, ich bin Lili.',
    voice: 'sanft, warm',
    imageUrl: '',
    imageOpenUrl: '',
    introUrl: 'https://storage.test/tutors/x/vorstellung.mp3',
    tone: 'sky' as const,
  },
];

const PROFILE: ChildProfileDto = {
  id: 'p1',
  displayName: 'Lisa',
  federalState: 'HE',
  grade: 3,
  interests: [],
  tutorId: null,
  voiceEnabled: false,
  dailyLimitMinutes: null,
  allowedWindow: null,
  learningInsights: false,
  guardianConfirmed: false,
  welcomeCompletedAt: null,
  voiceConsent: false,
};
const FAILED = { code: 'learner.persistence_failed', message: 'db down' };

function renderFlow(
  initial: Parameters<typeof OnboardingFlow>[0]['initial'] = { step: 'child', profile: null },
) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <OnboardingFlow initial={initial} tutors={TUTORS} />
    </I18nClientProvider>,
  );
}

async function chooseState(label: string) {
  const trigger = screen.getByRole('combobox', { name: 'Federal state' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: label }));
}

describe('onboarding flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Radix Select reads these from the browser; the test DOM has none.
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  });

  it('starts at the welcome screen, which saves nothing', () => {
    renderFlow();
    expect(screen.getByRole('heading', { name: 'Let’s set things up together' })).toBeVisible();
    expect(screen.getAllByText(/Step 1 of 8/)[0]).toBeVisible();
    expect(createChildProfileAction).not.toHaveBeenCalled();
  });

  it('refuses an incomplete child profile, then saves it and moves to the interests', async () => {
    vi.mocked(createChildProfileAction).mockResolvedValue({ ok: true, data: PROFILE });
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Please enter a name for your child.')).toBeVisible();
    expect(createChildProfileAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('What should Hort call your child?'), {
      target: { value: ' Lisa ' },
    });
    await chooseState('Hesse');
    fireEvent.click(screen.getByRole('radio', { name: 'Grade 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'What does Lisa enjoy?' })).toBeVisible();
    expect(createChildProfileAction).toHaveBeenCalledWith({
      displayName: 'Lisa',
      federalState: 'HE',
      grade: '3',
    });
  });

  it('keeps the parent on the step with the input when saving fails or gets no answer', async () => {
    vi.mocked(createChildProfileAction)
      .mockResolvedValueOnce({ ok: false, error: FAILED })
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    fireEvent.change(screen.getByLabelText('What should Hort call your child?'), {
      target: { value: 'Lisa' },
    });
    await chooseState('Hesse');
    fireEvent.click(screen.getByRole('radio', { name: 'Grade 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/Nothing was changed/)).toBeVisible();

    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/could not confirm that this was saved/)).toBeVisible();
    expect(screen.getByLabelText('What should Hort call your child?')).toHaveValue('Lisa');
  });

  it('saves the chosen interests', async () => {
    vi.mocked(saveInterestsAction).mockResolvedValue({ ok: true, data: PROFILE });
    renderFlow({ step: 'interests', profile: PROFILE });
    fireEvent.click(screen.getByRole('button', { name: /Nature/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sports/ }));
    expect(screen.getByText(/2 of 4 chosen/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Who should help Lisa?' })).toBeVisible();
    expect(saveInterestsAction).toHaveBeenCalledWith({
      interests: ['nature', 'sports'],
      profileId: 'p1',
    });
  });

  it('locks further interests at the limit', () => {
    renderFlow({ step: 'interests', profile: PROFILE });
    for (const name of [/Nature/, /Animals/, /Art/, /Music/]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(screen.getByRole('button', { name: /Sports/ })).toBeDisabled();
    expect(screen.getByText(/That is the maximum/)).toBeVisible();
  });

  it('recommends the companion that fits, requires a choice, and saves it', async () => {
    vi.mocked(chooseTutorAction).mockResolvedValue({
      ok: true,
      data: { ...PROFILE, tutorId: 'max' },
    });
    renderFlow({ step: 'tutor', profile: { ...PROFILE, interests: ['sports'] } });
    expect(screen.getByText('Fits Sports')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Please choose a companion.')).toBeVisible();
    expect(chooseTutorAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /Max/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Connect Alexa (optional)' })).toBeVisible();
    expect(chooseTutorAction).toHaveBeenCalledWith({ tutorId: 'max', profileId: 'p1' });
  });

  it('plays the spoken introduction of the chosen companion only on request, and stops it again', () => {
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    const created: string[] = [];
    vi.stubGlobal(
      'Audio',
      class {
        currentTime = 0;
        constructor(url: string) {
          created.push(url);
        }
        play = play;
        pause = pause;
      },
    );
    renderFlow({ step: 'tutor', profile: PROFILE });
    expect(screen.getByText('Tap a companion to meet them.')).toBeVisible();
    expect(created).toEqual([]);

    fireEvent.click(screen.getByRole('radio', { name: /Max/ }));
    expect(created).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Hear Max introduce themselves' }));
    expect(created).toEqual(['https://storage.test/tutors/x/vorstellung.mp3']);
    expect(play).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Max is speaking…')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.queryByText('Max is speaking…')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('says so, and still lets the parent choose, when the introduction cannot be played', async () => {
    vi.stubGlobal(
      'Audio',
      class {
        currentTime = 0;
        play = () => Promise.reject(new Error('blocked'));
        pause = vi.fn();
      },
    );
    renderFlow({ step: 'tutor', profile: PROFILE });
    fireEvent.click(screen.getByRole('radio', { name: /Max/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Hear Max introduce themselves' }));
    expect(await screen.findByText(/introduction is not available right now/)).toBeVisible();
    expect(screen.getByRole('radio', { name: /Max/ })).toBeChecked();
    vi.unstubAllGlobals();
  });

  it('shows the optional Alexa step as a placeholder that saves nothing and never blocks', async () => {
    renderFlow({ step: 'tutor', profile: { ...PROFILE, tutorId: 'max' } });
    fireEvent.click(screen.getByRole('radio', { name: /Max/ }));
    vi.mocked(chooseTutorAction).mockResolvedValue({
      ok: true,
      data: { ...PROFILE, tutorId: 'max' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Connect Alexa (optional)' })).toBeVisible();
    expect(screen.getByText('Not available yet')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Connect with Alexa' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Connect later' }));
    expect(await screen.findByRole('heading', { name: 'Safety and settings' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Connect Alexa (optional)' })).toBeVisible();
  });

  it('starts every control at its most private value and needs the guardian confirmation', async () => {
    vi.mocked(saveControlsAction).mockResolvedValue({
      ok: true,
      data: { ...PROFILE, guardianConfirmed: true },
    });
    renderFlow({ step: 'controls', profile: { ...PROFILE, tutorId: 'max' } });
    expect(screen.getByText('Voice is off')).toBeVisible();
    expect(screen.getByText('Notes are off')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Please confirm that you are the parent or guardian.'),
    ).toBeVisible();
    expect(saveControlsAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('switch', { name: 'Talking to Max' }));
    expect(screen.getByRole('switch', { name: 'Talking to Max' })).toHaveAccessibleDescription(
      new RegExp(VOICE_NOTICE_VERSION),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: /I am the parent or legal guardian/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Is everything right?' })).toBeVisible();
    expect(saveControlsAction).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceEnabled: true,
        voiceNoticeVersion: VOICE_NOTICE_VERSION,
        dailyLimitMinutes: 'none',
        windowEnabled: false,
        learningInsights: false,
        guardianConfirmed: true,
        profileId: 'p1',
      }),
    );
  });

  it('shows what was stored, returns to the review after a change, and says "ready" only after the backend finished', async () => {
    const stored = { ...PROFILE, tutorId: 'max', guardianConfirmed: true, interests: ['sports'] };
    vi.mocked(createChildProfileAction).mockResolvedValue({
      ok: true,
      data: { ...stored, displayName: 'Lisa M' },
    });
    vi.mocked(completeSetupAction)
      .mockResolvedValueOnce({ ok: false, error: FAILED })
      .mockResolvedValueOnce({ ok: true, data: { ...stored, displayName: 'Lisa M' } });
    renderFlow({ step: 'review', profile: stored });
    expect(screen.getByText('Sports')).toBeVisible();
    expect(screen.getByText('Max')).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]!);
    fireEvent.change(await screen.findByLabelText('What should Hort call your child?'), {
      target: { value: 'Lisa M' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Is everything right?' })).toBeVisible();
    expect(screen.getByText('Lisa M')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    expect(await screen.findByText(/Nothing was changed/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Lisa M is ready!' })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Finish setup' }));
    expect(await screen.findByRole('heading', { name: 'Lisa M is ready!' })).toBeVisible();
    expect(screen.getByText('Wuff, hallo! Ich bin Max.')).toBeVisible();
    expect(completeSetupAction).toHaveBeenLastCalledWith({ profileId: 'p1' });
  });

  it('keeps the screens that are done marked as done while one of them is being changed', () => {
    const stored = { ...PROFILE, tutorId: 'max', guardianConfirmed: true, interests: ['sports'] };
    renderFlow({ step: 'review', profile: stored });
    const doneCount = () => screen.queryAllByText('Done').length;
    expect(doneCount()).toBe(6);

    fireEvent.click(screen.getAllByRole('button', { name: 'Change' })[0]!);
    // Changing the child: every other finished step stays done; only the review and the end are open.
    expect(doneCount()).toBe(5);
    expect(document.querySelector('[aria-current="step"]')).toHaveTextContent('Your child');
  });

  it('sends a parent who is already set up to the home instead of showing an error', async () => {
    vi.mocked(createChildProfileAction).mockResolvedValue({
      ok: false,
      error: { code: 'learner.already_onboarded', message: '' },
    });
    renderFlow();
    fireEvent.click(screen.getByRole('button', { name: /Get started/ }));
    fireEvent.change(screen.getByLabelText('What should Hort call your child?'), {
      target: { value: 'Lisa' },
    });
    await chooseState('Hesse');
    fireEvent.click(screen.getByRole('radio', { name: 'Grade 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/home');
    });
  });
});
