import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { claimDailyRewardAction } from '@modules/progression/presentation/actions/claim-daily-reward-action';
import { RewardsStep } from '@modules/progression/presentation/components/rewards-step';
import type {
  ClaimDailyRewardDto,
  ProgressDto,
} from '@modules/progression/presentation/dto/progress-dto';
import en from '@modules/progression/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

vi.mock('@modules/progression/presentation/actions/claim-daily-reward-action', () => ({
  claimDailyRewardAction: vi.fn(),
}));

const COMPANION = {
  id: 'max',
  name: 'Max',
  imageUrl: 'https://storage.test/tutors/max/mund-zu.svg',
  imageOpenUrl: 'https://storage.test/tutors/max/mund-auf.svg',
};

const AVAILABLE: ProgressDto = {
  childProfileId: 'child-1',
  xp: 15,
  level: 1,
  maxLevel: 6,
  xpIntoLevel: 15,
  xpForNextLevel: 20,
  fraction: 0.75,
  dailyReward: { status: 'available', xp: 5, dayKey: '2026-10-25' },
  mood: 'sleepy',
  boredomLevel: 2,
  daysAway: 2,
  lastActivityAt: '2026-10-23T10:00:00.000Z',
};

const CLAIMED: ProgressDto = {
  ...AVAILABLE,
  xp: 20,
  level: 2,
  xpIntoLevel: 0,
  xpForNextLevel: 30,
  fraction: 0,
  dailyReward: { status: 'claimed', xp: 5, dayKey: '2026-10-25' },
  mood: 'cheerful',
  boredomLevel: 0,
  daysAway: 0,
};

const STAYED: ProgressDto = {
  ...CLAIMED,
  xp: 17,
  level: 1,
  xpIntoLevel: 17,
  xpForNextLevel: 20,
  fraction: 0.85,
};

const GRANTED: ClaimDailyRewardDto = { outcome: 'granted', leveledUp: false, progress: STAYED };
const LEVELLED: ClaimDailyRewardDto = { outcome: 'granted', leveledUp: true, progress: CLAIMED };

function stubMotion(isReduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: isReduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function renderStep(initial: ProgressDto = AVAILABLE) {
  const onContinue = vi.fn();
  render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <RewardsStep initial={initial} companion={COMPANION} onContinue={onContinue} />
    </I18nClientProvider>,
  );
  return { onContinue };
}

const food = () => screen.getByRole('button', { name: /^(Feed Max|Try again)$/ });
const bar = () => screen.getByRole('progressbar', { name: 'Your level' });
const bubble = () => screen.getByRole('status');

/** Pointer events as a finger sends them; the mouth and the food sit at the origin in a test DOM. */
function drag(element: HTMLElement, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

describe('RewardsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubMotion(false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws the meter from the real numbers as an accessible progressbar', () => {
    renderStep();
    expect(bar()).toHaveAttribute('aria-valuemin', '0');
    expect(bar()).toHaveAttribute('aria-valuemax', '100');
    expect(bar()).toHaveAttribute('aria-valuenow', '75');
    expect(bar()).toHaveAttribute('aria-valuetext', 'Level 1, 15 of 20 stars to level 2');
    expect(screen.getByRole('list', { name: 'All levels' }).children).toHaveLength(6);
    expect(screen.getByText('Level 1, your level')).toBeInTheDocument();
    expect(screen.getByText('Level 2, still to come')).toBeInTheDocument();
  });

  it('waits with the food on its plate and sends nothing until the child feeds it', () => {
    renderStep();
    expect(screen.getByRole('heading', { level: 1, name: 'Snack time!' })).toBeVisible();
    expect(bubble()).toHaveTextContent('Yawn … snack?');
    expect(screen.getByText('Tap or drag')).toBeVisible();
    expect(food()).toBeEnabled();
    expect(claimDailyRewardAction).not.toHaveBeenCalled();
  });

  it('is a real button a keyboard can reach and press, with a name', () => {
    renderStep();
    expect(food().tagName).toBe('BUTTON');
    expect(food()).not.toHaveAttribute('tabindex', '-1');
  });

  it('claims only once the tapped food has reached the mouth, and shows the star only after the server confirmed', async () => {
    let resolve: (value: { ok: true; data: ClaimDailyRewardDto }) => void = () => undefined;
    vi.mocked(claimDailyRewardAction).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderStep();
    fireEvent.click(food());

    // the food is flying: nothing has been sent yet
    expect(claimDailyRewardAction).not.toHaveBeenCalled();
    expect(food()).toHaveAttribute('data-place', 'mouth');
    await waitFor(() => {
      expect(claimDailyRewardAction).toHaveBeenCalledTimes(1);
    });
    expect(claimDailyRewardAction).toHaveBeenCalledWith({ childProfileId: 'child-1' });
    expect(bubble()).toHaveTextContent('Mmm …');
    expect(bar()).toHaveAttribute('aria-valuenow', '75');
    expect(document.querySelector('[data-star-flight]')).toBeNull();
    // a second tap while the first is on its way sends nothing
    fireEvent.click(food());
    expect(claimDailyRewardAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ ok: true, data: GRANTED });
      await Promise.resolve();
    });
    expect(await screen.findByText(/Yum, thank you!/)).toBeVisible();
    expect(bubble()).toHaveTextContent('You got 5 stars.');
    expect(bar()).toHaveAttribute('aria-valuenow', '85');
    expect(screen.queryByRole('button', { name: 'Feed Max' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-star-flight]')).not.toBeNull();
    expect(document.querySelector('[data-hearts]')).not.toBeNull();
    expect(document.querySelector('[data-level-up]')).toBeNull();
  });

  it('claims at once when the food is dropped on the mouth', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({ ok: true, data: GRANTED });
    renderStep();
    drag(food(), [120, 140], [0, 0]);

    await waitFor(() => {
      expect(claimDailyRewardAction).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Yum, thank you!/)).toBeVisible();
  });

  it('sends the food back to the plate, and claims nothing, when it is dropped elsewhere', () => {
    renderStep();
    drag(food(), [10, 10], [400, 400]);

    expect(food()).toHaveAttribute('data-place', 'tray');
    expect(claimDailyRewardAction).not.toHaveBeenCalled();
  });

  it('does not count a tiny wobble of the finger as a drag: it is a tap', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({ ok: true, data: GRANTED });
    renderStep();
    drag(food(), [10, 10], [12, 11]);
    fireEvent.click(food());

    await waitFor(() => {
      expect(claimDailyRewardAction).toHaveBeenCalledTimes(1);
    });
  });

  it('does not celebrate a level-up when the server did not report one', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({ ok: true, data: GRANTED });
    renderStep();
    fireEvent.click(food());

    await screen.findByText(/Yum, thank you!/);
    expect(screen.queryByText(/Yay/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-level-up]')).toBeNull();
  });

  it('celebrates a level-up when the server reports one, with the new level and a fresh bar', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({ ok: true, data: LEVELLED });
    renderStep();
    fireEvent.click(food());

    expect(await screen.findByText('Level 2! Yay!')).toBeVisible();
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
    expect(document.querySelector('[data-level-up]')).not.toBeNull();
  });

  it('treats "already claimed" as calm: no celebration, the server numbers, no food', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({
      ok: true,
      data: { outcome: 'already_claimed', leveledUp: true, progress: CLAIMED },
    });
    renderStep();
    fireEvent.click(food());

    expect(await screen.findByText('Full and happy!')).toBeVisible();
    expect(screen.getByText('See you tomorrow!')).toBeVisible();
    expect(screen.queryByText(/Yum/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-star-flight]')).toBeNull();
    expect(document.querySelector('[data-hearts]')).toBeNull();
    expect(document.querySelector('[data-level-up]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Feed Max' })).not.toBeInTheDocument();
  });

  it('opens fed and content when today’s star was picked up before: no food on the plate', () => {
    renderStep(CLAIMED);
    expect(bubble()).toHaveTextContent('Full and happy!');
    expect(screen.getByText('See you tomorrow!')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Feed Max' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tap or drag')).not.toBeInTheDocument();
  });

  it('shows an error without any success, sends the food back and lets the child try again', async () => {
    vi.mocked(claimDailyRewardAction)
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'progression.persistence_failed', message: 'db down' },
      })
      .mockResolvedValueOnce({ ok: true, data: GRANTED });
    renderStep();
    fireEvent.click(food());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That did not work. Please try again.',
    );
    expect(screen.queryByText(/Yum/)).not.toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '75');
    expect(document.querySelector('[data-star-flight]')).toBeNull();
    expect(food()).toHaveAttribute('data-place', 'tray');

    fireEvent.click(food());
    expect(await screen.findByText(/Yum, thank you!/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(claimDailyRewardAction).toHaveBeenCalledTimes(2);
  });

  it('treats a request that never got an answer as a failure too', async () => {
    vi.mocked(claimDailyRewardAction).mockRejectedValue(new Error('offline'));
    renderStep();
    fireEvent.click(food());

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText(/Yum/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('lets the child continue at any time, also while a claim is on its way', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(claimDailyRewardAction).mockReturnValue(
      new Promise((done) => {
        finish = () => {
          done({ ok: true, data: GRANTED });
        };
      }),
    );
    const { onContinue } = renderStep();
    fireEvent.click(food());
    await screen.findByText('Mmm …');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();

    // an unfinished request would hold back React's other async work in later tests
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await screen.findByText(/Yum, thank you!/);
  });

  it('with reduced motion: no flight, no hearts, the food goes straight in, and the words say the same', async () => {
    stubMotion(true);
    vi.mocked(claimDailyRewardAction).mockResolvedValue({ ok: true, data: GRANTED });
    renderStep();
    fireEvent.click(food());

    expect(await screen.findByText(/Yum, thank you!/)).toBeVisible();
    expect(bubble()).toHaveTextContent('You got 5 stars.');
    expect(bar()).toHaveAttribute('aria-valuenow', '85');
    expect(document.querySelector('[data-star-flight]')).toBeNull();
    expect(document.querySelector('[data-hearts]')).toBeNull();
  });

  it('describes the sleepy companion warmly, never as sad', () => {
    renderStep();
    expect(screen.getByRole('img', { name: 'Max is sleepy and happy to see you.' })).toBeVisible();
  });
});
