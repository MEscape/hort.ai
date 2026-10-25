import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimDailyRewardAction } from '@modules/progression/presentation/actions/claim-daily-reward-action';
import { CompanionCard } from '@modules/progression/presentation/components/companion-card';
import type { ProgressDto } from '@modules/progression/presentation/dto/progress-dto';
import en from '@modules/progression/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

vi.mock('@modules/progression/presentation/actions/claim-daily-reward-action', () => ({
  claimDailyRewardAction: vi.fn(),
}));

const COMPANION = {
  id: 'lili',
  name: 'Lili',
  imageUrl: 'https://storage.test/tutors/lili/mund-zu.svg',
  imageOpenUrl: 'https://storage.test/tutors/lili/mund-auf.svg',
};

const VERY_BORED: ProgressDto = {
  childProfileId: 'child-1',
  xp: 40,
  level: 2,
  maxLevel: 6,
  xpIntoLevel: 20,
  xpForNextLevel: 30,
  fraction: 2 / 3,
  dailyReward: { status: 'available', xp: 5, dayKey: '2026-10-25' },
  mood: 'bored',
  boredomLevel: 4,
  daysAway: 9,
  lastActivityAt: '2026-10-16T10:00:00.000Z',
};

const FED_TODAY: ProgressDto = {
  ...VERY_BORED,
  dailyReward: { status: 'claimed', xp: 5, dayKey: '2026-10-25' },
  mood: 'cheerful',
  boredomLevel: 0,
  daysAway: 0,
};

function renderCard(progress: ProgressDto) {
  render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <CompanionCard progress={progress} companion={COMPANION} />
    </I18nClientProvider>,
  );
}

describe('CompanionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });

  it('shows the very bored companion with its snack thought, the real meter and the food, without any guilt', () => {
    renderCard(VERY_BORED);
    expect(screen.getByRole('heading', { level: 2, name: 'Lili' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Snack time?');
    expect(document.querySelector('[data-thought="snack"]')).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Your level' })).toHaveAttribute(
      'aria-valuenow',
      '67',
    );
    expect(screen.getByRole('button', { name: 'Feed Lili' })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/sad|lonely|miss|where were you/i);
    expect(claimDailyRewardAction).not.toHaveBeenCalled();
  });

  it('is content once fed today: lively face, no food, a quiet "see you tomorrow"', () => {
    renderCard(FED_TODAY);
    expect(screen.getByRole('status')).toHaveTextContent('Full and happy!');
    expect(screen.getByText('See you tomorrow!')).toBeVisible();
    expect(document.querySelector('[data-thought="snack"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Feed Lili' })).not.toBeInTheDocument();
  });

  it('feeds with the same real claim as the welcome and cheers up the same companion at once', async () => {
    vi.mocked(claimDailyRewardAction).mockResolvedValue({
      ok: true,
      data: { outcome: 'granted', leveledUp: false, progress: FED_TODAY },
    });
    renderCard(VERY_BORED);
    fireEvent.click(screen.getByRole('button', { name: 'Feed Lili' }));

    expect(await screen.findByText(/Yum, thank you!/)).toBeVisible();
    expect(claimDailyRewardAction).toHaveBeenCalledWith({ childProfileId: 'child-1' });
    expect(document.querySelector('[data-thought="snack"]')).toBeNull();
    expect(document.querySelector('[data-boredom="0"]')).not.toBeNull();
  });
});
