import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { HomeScreen } from '@/app/[locale]/(app)/home/_components/home-screen';
import app from '@/i18n/messages/en.json';

import { stubMotion } from '../../components/shared/fake-audio';

vi.mock('@/app/[locale]/(app)/home/_components/screen-time-view', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  CLOSED_KEEPS_COMPANION_AND_WORLD: false,
}));
vi.mock('@i18n', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@modules/world/client', () => ({
  worldRoutes: { map: () => '/world' },
  IslandArt: () => <svg />,
}));
vi.mock('@modules/progression/client', () => ({
  CompanionCard: () => <section aria-label="Lili stage" />,
  CompanionAvatar: () => <span />,
}));

const data = {
  childName: 'Mia',
  hasVoice: true,
  controls: { dailyLimitMinutes: null, allowedWindow: { fromMinute: 900, untilMinute: 1080 } },
  serverNow: '2026-01-15T10:00:00.000Z',
  usedMinutes: null,
  session: null,
  unfinished: null,
  teacherNewCount: null,
  world: [],
  speech: { speakerId: 'lili', isAllowed: false },
};

describe('HomeScreen when a closed day also pauses feeding and the world', () => {
  beforeEach(() => {
    stubMotion(false);
    window.sessionStorage.setItem(
      'hortai.home.greeting',
      JSON.stringify({ line: 'x', at: Date.parse(data.serverNow) }),
    );
  });

  it('makes the stage and the world card unreachable, by pointer and keyboard', () => {
    const { container } = render(
      <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
        <HomeScreen
          data={data}
          companion={{ name: 'Lili', imageUrl: '/a', imageOpenUrl: '/b' }}
          progress={{ mood: 'calm', boredomLevel: 0 } as never}
        />
      </I18nClientProvider>,
    );
    const stage = container.querySelector('[data-guide-target="stage"]');
    const world = container.querySelector('[data-guide-target="world"]')?.closest('[inert]');
    expect(stage).toHaveAttribute('inert');
    expect(world).not.toBeNull();
  });
});
