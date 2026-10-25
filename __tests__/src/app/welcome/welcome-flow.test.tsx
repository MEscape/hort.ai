import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  chooseChildTutorAction,
  completeChildWelcomeAction,
  saveChildInterestsAction,
} from '@modules/learner/client';
import type { ChildProfileDto, TutorOption } from '@modules/learner/client';
import en from '@modules/learner/presentation/i18n/en.json';
import type { ProgressDto } from '@modules/progression/client';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

import { WelcomeFlow } from '@/app/[locale]/(app)/hello/_components/welcome-flow';
import app from '@/i18n/messages/en.json';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ replace }),
}));
vi.mock('@modules/learner/client', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  saveChildInterestsAction: vi.fn(),
  chooseChildTutorAction: vi.fn(),
  completeChildWelcomeAction: vi.fn(),
}));
// The other agents' pieces are tested with them; here only the contract (props in, callbacks out) counts.
vi.mock('@modules/progression/client', () => ({
  CompanionAvatar: ({
    mood,
    boredomLevel,
    reaction,
  }: {
    mood: string;
    boredomLevel?: number;
    reaction?: string;
  }) => (
    <div
      data-testid="avatar"
      data-mood={mood}
      data-boredom={boredomLevel}
      data-reaction={reaction ?? 'none'}
    />
  ),
  RewardsStep: ({ onContinue }: { onContinue: () => void }) => (
    <section>
      <h1 tabIndex={-1}>Rewards stub</h1>
      <button type="button" onClick={onContinue}>
        rewards continue
      </button>
    </section>
  ),
}));
vi.mock('@/app/[locale]/(app)/hello/_components/companion-step', () => ({
  CompanionStep: (props: {
    interests: readonly string[];
    initialTutorId: string | null;
    error: string | null;
    isSaving: boolean;
    onContinue: (tutorId: string) => void;
  }) => (
    <section>
      <h1 tabIndex={-1}>Companion stub</h1>
      <p>interests:{props.interests.join(',')}</p>
      <p>initial:{props.initialTutorId ?? 'none'}</p>
      {props.error !== null && <p role="alert">{props.error}</p>}
      <button
        type="button"
        onClick={() => {
          props.onContinue('lili');
        }}
      >
        choose lili
      </button>
    </section>
  ),
}));
vi.mock('@/app/[locale]/(app)/hello/_components/voice-step', () => ({
  VoiceStep: (props: { tutor: { id: string }; onContinue: () => void }) => (
    <section>
      <h1 tabIndex={-1}>Voice stub {props.tutor.id}</h1>
      <button type="button" onClick={props.onContinue}>
        voice continue
      </button>
    </section>
  ),
}));

const TUTORS: readonly TutorOption[] = ['max', 'lili'].map((id) => ({
  id,
  name: id === 'max' ? 'Max' : 'Lili',
  animal: 'Tier',
  description: '',
  traits: [],
  topics: [],
  greeting: 'Hallo',
  voice: 'warm',
  imageUrl: '',
  imageOpenUrl: '',
  introUrl: '',
}));

const PROFILE: ChildProfileDto = {
  id: 'p1',
  displayName: 'Lisa',
  federalState: 'HE',
  grade: 3,
  interests: ['animals', 'music'],
  tutorId: 'max',
  voiceEnabled: true,
  dailyLimitMinutes: null,
  allowedWindow: null,
  learningInsights: false,
  guardianConfirmed: true,
  welcomeCompletedAt: null,
};

const PROGRESS: ProgressDto = {
  childProfileId: 'p1',
  xp: 0,
  level: 1,
  maxLevel: 6,
  xpIntoLevel: 0,
  xpForNextLevel: 20,
  fraction: 0,
  dailyReward: { status: 'available', xp: 5, dayKey: '2026-10-25' },
  mood: 'new',
  boredomLevel: 0,
  daysAway: 0,
  lastActivityAt: null,
};

const FAILED = { ok: false as const, error: { code: 'learner.persistence_failed', message: 'x' } };
const saved = (patch: Partial<ChildProfileDto>) => ({
  ok: true as const,
  data: { ...PROFILE, ...patch },
});

function renderFlow(profile: ChildProfileDto = PROFILE) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <WelcomeFlow profile={profile} tutors={TUTORS} progress={PROGRESS} />
    </I18nClientProvider>,
  );
}

const heading = () => screen.getByRole('heading', { level: 1 });
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
// Settles the save the press starts, so the test never races a clock under load.
const pressAndSettle = (name: string | RegExp) =>
  act(async () => {
    press(name);
  });

function tile(name: string) {
  return screen.getByRole('button', { name });
}

describe('child welcome flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(saveChildInterestsAction).mockResolvedValue(saved({}));
    vi.mocked(chooseChildTutorAction).mockResolvedValue(saved({ tutorId: 'lili' }));
    vi.mocked(completeChildWelcomeAction).mockResolvedValue(
      saved({ welcomeCompletedAt: '2026-10-25T10:00:00.000Z' }),
    );
  });

  it('greets the child first, with the companion mood from the real progress', () => {
    renderFlow();
    expect(heading()).toHaveTextContent('Hi Lisa!');
    expect(screen.getByText('I’m Max!')).toBeInTheDocument();
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-mood', 'new');
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-boredom', '0');
    expect(screen.getByRole('list', { name: 'Your first steps' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(saveChildInterestsAction).not.toHaveBeenCalled();
  });

  it('shows the parent’s interests preselected, never by colour alone', () => {
    renderFlow();
    press('Let’s go');
    expect(heading()).toHaveTextContent('Your favorites');
    expect(tile('Animals')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Music')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Art')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
  });

  it('runs the stages in order, interests strictly before the companion', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    expect(screen.queryByText('Companion stub')).not.toBeInTheDocument();
    await pressAndSettle('Next');
    expect(await screen.findByText('Companion stub')).toBeInTheDocument();
    await pressAndSettle('choose lili');
    expect(await screen.findByText('Voice stub lili')).toBeInTheDocument();
    await pressAndSettle('voice continue');
    expect(screen.getByText('Rewards stub')).toBeInTheDocument();
    await pressAndSettle('rewards continue');
    expect(heading()).toHaveTextContent('All set, Lisa!');
    expect(screen.getByText('Lili is ready!')).toBeInTheDocument();
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();
    expect(screen.getByTestId('avatar')).toHaveAttribute('data-reaction', 'cheer');
  });

  it('saves the final set when the interests changed, and hands it to the companion step', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    fireEvent.click(tile('Music'));
    fireEvent.click(tile('Art'));
    vi.mocked(saveChildInterestsAction).mockResolvedValue(saved({ interests: ['animals', 'art'] }));
    await pressAndSettle('Next');
    expect(await screen.findByText('Companion stub')).toBeInTheDocument();
    expect(saveChildInterestsAction).toHaveBeenCalledWith({
      profileId: 'p1',
      interests: ['animals', 'art'],
    });
    expect(screen.getByText('interests:animals,art')).toBeInTheDocument();
  });

  it('does not call the server when nothing changed', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    await pressAndSettle('Next');
    expect(await screen.findByText('Companion stub')).toBeInTheDocument();
    expect(saveChildInterestsAction).not.toHaveBeenCalled();
  });

  it('dims every free tile at four, shakes a tapped one and says so in the bubble', () => {
    renderFlow({ ...PROFILE, interests: ['animals', 'music', 'art', 'nature'] });
    press('Let’s go');
    expect(screen.getByText('4 is plenty!')).toBeInTheDocument();
    expect(tile('Puzzles')).toHaveAttribute('aria-disabled', 'true');
    expect(tile('Animals')).not.toHaveAttribute('aria-disabled');
    fireEvent.click(tile('Puzzles'));
    expect(tile('Puzzles')).toHaveAttribute('aria-pressed', 'false');
    expect(tile('Puzzles').className).toContain('animate-wobble');
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
  });

  it('frees a place at once when a chosen tile is tapped', () => {
    renderFlow({ ...PROFILE, interests: ['animals', 'music', 'art', 'nature'] });
    press('Let’s go');
    fireEvent.click(tile('Art'));
    expect(tile('Art')).toHaveAttribute('aria-pressed', 'false');
    expect(tile('Puzzles')).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText('3 of 4')).toBeInTheDocument();
    expect(screen.getByText('Tap what you love!')).toBeInTheDocument();
    fireEvent.click(tile('Puzzles'));
    expect(tile('Puzzles')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Technology')).toHaveAttribute('aria-disabled', 'true');
  });

  it('moves only behind motion-safe, so calm mode and reduced motion stay still', () => {
    renderFlow();
    press('Let’s go');
    fireEvent.click(tile('Art'));
    expect(tile('Art').className).toContain('motion-safe:animate-hop');
    expect(tile('Art').className).not.toMatch(/(^|\s)animate-/);
    fireEvent.click(tile('Puzzles'));
    fireEvent.click(tile('Technology'));
    fireEvent.click(tile('Books'));
    expect(tile('Books').className).toContain('motion-safe:animate-wobble');
    expect(tile('Books').className).not.toMatch(/(^|\s)animate-/);
  });

  it('shows the first screen at once and lets only the following screens slide in', async () => {
    renderFlow();
    const main = () => screen.getByRole('main');
    expect(main().className).not.toContain('animate-in');
    await pressAndSettle('Let’s go');
    expect(main().className).toContain('motion-safe:animate-in');
  });

  it('paints no ground shadow under the companion', () => {
    const { container } = renderFlow();
    expect(container.querySelector('[class*="bg-primary/15"]')).not.toBeInTheDocument();
  });

  it('puts focus on the heading again when the child goes back', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
    await pressAndSettle('Back');
    await waitFor(() => {
      expect(heading()).toHaveTextContent('Hi Lisa!');
      expect(heading()).toHaveFocus();
    });
  });

  it('lets the child continue with no interest at all', async () => {
    renderFlow({ ...PROFILE, interests: ['animals'] });
    await pressAndSettle('Let’s go');
    fireEvent.click(tile('Animals'));
    vi.mocked(saveChildInterestsAction).mockResolvedValue(saved({ interests: [] }));
    await pressAndSettle('Next');
    expect(await screen.findByText('Companion stub')).toBeInTheDocument();
    expect(saveChildInterestsAction).toHaveBeenCalledWith({ profileId: 'p1', interests: [] });
  });

  it('stays on the interests with an error and a retry when saving fails', async () => {
    vi.mocked(saveChildInterestsAction).mockResolvedValueOnce(FAILED);
    renderFlow();
    await pressAndSettle('Let’s go');
    fireEvent.click(tile('Art'));
    await pressAndSettle('Next');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('That didn’t save');
    expect(heading()).toHaveTextContent('Your favorites');
    expect(tile('Art')).toHaveAttribute('aria-pressed', 'true');
    vi.mocked(saveChildInterestsAction).mockResolvedValueOnce(
      saved({ interests: ['animals', 'music', 'art'] }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Companion stub')).toBeInTheDocument();
    expect(saveChildInterestsAction).toHaveBeenCalledTimes(2);
  });

  it('treats a request that never answered like a failed save', async () => {
    vi.mocked(saveChildInterestsAction).mockRejectedValueOnce(new Error('offline'));
    renderFlow();
    await pressAndSettle('Let’s go');
    fireEvent.click(tile('Art'));
    await pressAndSettle('Next');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(heading()).toHaveTextContent('Your favorites');
  });

  it('saves the chosen companion and stays with an error when that fails', async () => {
    vi.mocked(chooseChildTutorAction).mockResolvedValueOnce(FAILED);
    renderFlow();
    await pressAndSettle('Let’s go');
    await pressAndSettle('Next');
    await screen.findByText('Companion stub');
    expect(screen.getByText('initial:max')).toBeInTheDocument();
    await pressAndSettle('choose lili');
    expect(
      await within(await screen.findByRole('alert')).findByText(/didn’t save/),
    ).toBeInTheDocument();
    expect(screen.getByText('Companion stub')).toBeInTheDocument();
    await pressAndSettle('choose lili');
    expect(await screen.findByText('Voice stub lili')).toBeInTheDocument();
    expect(chooseChildTutorAction).toHaveBeenCalledWith({ profileId: 'p1', tutorId: 'lili' });
  });

  it('keeps the choices when the child goes back', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    fireEvent.click(tile('Art'));
    vi.mocked(saveChildInterestsAction).mockResolvedValue(
      saved({ interests: ['animals', 'music', 'art'] }),
    );
    await pressAndSettle('Next');
    await screen.findByText('Companion stub');
    await pressAndSettle('Back');
    expect(tile('Art')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('Animals')).toHaveAttribute('aria-pressed', 'true');
    await pressAndSettle('Back');
    expect(heading()).toHaveTextContent('Hi Lisa!');
  });

  it('moves focus to the new step heading', async () => {
    renderFlow();
    await pressAndSettle('Let’s go');
    await waitFor(() => {
      expect(heading()).toHaveFocus();
    });
  });

  it('leaves for the home only after the backend confirmed the end', async () => {
    vi.mocked(completeChildWelcomeAction).mockResolvedValueOnce(FAILED);
    renderFlow();
    await pressAndSettle('Let’s go');
    await pressAndSettle('Next');
    await screen.findByText('Companion stub');
    await pressAndSettle('choose lili');
    await screen.findByText('Voice stub lili');
    await pressAndSettle('voice continue');
    await pressAndSettle('rewards continue');
    await pressAndSettle('Go!');
    expect(await screen.findByRole('alert')).toHaveTextContent('That didn’t save');
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/home');
    });
    expect(completeChildWelcomeAction).toHaveBeenCalledWith({ profileId: 'p1' });
  });

  it('goes home when the welcome was already completed elsewhere', async () => {
    vi.mocked(completeChildWelcomeAction).mockResolvedValueOnce({
      ok: false,
      error: { code: 'learner.welcome_already_completed', message: 'done' },
    });
    renderFlow();
    await pressAndSettle('Let’s go');
    await pressAndSettle('Next');
    await screen.findByText('Companion stub');
    await pressAndSettle('choose lili');
    await screen.findByText('Voice stub lili');
    await pressAndSettle('voice continue');
    await pressAndSettle('rewards continue');
    await pressAndSettle('Go!');
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/home');
    });
  });
});
