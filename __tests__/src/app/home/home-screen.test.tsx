import type { ReactElement } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { HomeScreen } from '@/app/[locale]/(app)/home/_components/home-screen';
import type { HomeData } from '@/app/[locale]/(app)/home/_components/home-types';
import app from '@/i18n/messages/en.json';

import { stubMotion } from '../../components/shared/fake-audio';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('@i18n', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useRouter: () => ({ push: navigate }),
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@modules/world/client', () => ({
  worldRoutes: { map: () => '/world' },
  IslandArt: () => <svg />,
}));
vi.mock('@modules/progression/client', () => ({
  CompanionCard: ({ guided }: { guided?: string }) => (
    <section aria-label="Lili stage" data-guided-state={guided ?? 'none'}>
      <div data-guide-meter="" />
      <div data-guide-home="">stage companion</div>
    </section>
  ),
  CompanionAvatar: () => <span>copy</span>,
}));

/** 11:00 in Berlin on a winter morning (UTC+1). */
const SERVER_NOW = '2026-01-15T10:00:00.000Z';
const MEMORY_KEY = 'hortai.home.greeting';
const companion = { id: 'lili', name: 'Lili', imageUrl: '/a.png', imageOpenUrl: '/b.png' };
const progress = { mood: 'calm', boredomLevel: 0 } as never;

const baseData: HomeData = {
  childName: 'Mia',
  hasVoice: true,
  controls: { dailyLimitMinutes: null, allowedWindow: null },
  serverNow: SERVER_NOW,
  usedMinutes: null,
  session: null,
  unfinished: null,
  teacherNewCount: null,
  world: [],
  speech: { speakerId: 'lili', isAllowed: false },
};

function renderHome(overrides: Partial<HomeData> = {}): ReactElement {
  const ui = (
    <I18nClientProvider locale="en" messages={{ app }} timeZone="Europe/Berlin" isDevelopment>
      <HomeScreen data={{ ...baseData, ...overrides }} companion={companion} progress={progress} />
    </I18nClientProvider>
  );
  render(ui);
  return ui;
}

const bubble = () => screen.queryAllByText(/./, { selector: 'p.animate-pop' });
/** Advances in small steps, each in its own `act`, so a phase's effect runs before the next timer. */
function speak(ms = 0): void {
  const step = 100;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    act(() => {
      vi.advanceTimersByTime(step);
    });
  }
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  stubMotion(false);
  window.sessionStorage.setItem(
    MEMORY_KEY,
    JSON.stringify({ line: 'x', at: Date.parse(SERVER_NOW) }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('HomeScreen', () => {
  it('keeps the original companion throughout a guide interaction without mounting a copy', () => {
    renderHome();
    const original = screen.getByText('stage companion');
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(800);
    expect(screen.queryByText('copy')).not.toBeInTheDocument();
    expect(screen.getByText('stage companion')).toBe(original);
    speak(10_000);
    expect(screen.getByText('stage companion')).toBe(original);
    expect(document.querySelector('[data-guide-copy]')).toBeNull();
  });

  it('cancels the arrival greeting when the child already chose an interaction', () => {
    window.sessionStorage.clear();
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(1500);
    expect(screen.queryByText('Hello! I am glad you are here.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Photos are coming soon!').length).toBeGreaterThan(0);
  });
  it('shows the status strip, the companion and the cards, and no navigation bar', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Hi Mia!' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Your day' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'I have a task' })).toBeVisible();
    expect(screen.getByRole('link', { name: /From my teacher/ })).toHaveAttribute(
      'href',
      '/help?new=1',
    );
    expect(screen.getByRole('link', { name: /Mia's world/i })).toHaveAttribute('href', '/world');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('hides the continue card when nothing is unfinished and shows it, without a solution, when something is', () => {
    renderHome();
    expect(screen.queryByText(/Continue:/)).not.toBeInTheDocument();
    document.body.innerHTML = '';
    renderHome({
      unfinished: {
        title: 'Apples',
        area: 'Maths',
        lastStep: 'Counting the groups',
        updatedAt: '2026-01-15T08:00:00.000Z',
        href: '/session/1',
      },
    });
    const card = screen.getByRole('link', { name: /Continue: Apples/ });
    expect(card).toHaveAttribute('href', '/session/1');
    expect(card).toHaveTextContent('Maths, last step: Counting the groups');
    expect(card).toHaveTextContent('2 hours ago');
  });

  it('has no bubble while the companion is silent, and one line when a card that stays is tapped', () => {
    renderHome();
    expect(bubble()).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    expect(bubble()).toHaveLength(0);
    speak(800);
    expect(bubble()).toHaveLength(1);
    expect(screen.getAllByText('Photos are coming soon!').length).toBeGreaterThan(0);
  });

  it('writes that nothing is new when the teacher has nothing, and the count when there is', () => {
    renderHome({ teacherNewCount: 0 });
    expect(screen.getByRole('link', { name: /Nothing new right now\./ })).toBeVisible();
    document.body.innerHTML = '';
    renderHome({ teacherNewCount: 2 });
    expect(screen.getByRole('link', { name: /2 new/ })).toHaveAttribute('href', '/help?new=1');
  });

  it('fades the level meter while the stage itself speaks, so the bubble covers nothing', () => {
    window.sessionStorage.clear();
    renderHome();
    speak(1000);
    expect(screen.getByLabelText('Lili stage')).toHaveAttribute('data-guided-state', 'speaking');
  });

  it('lets a new tap replace the current line, one line at a time', () => {
    renderHome({ hasVoice: false });
    fireEvent.click(screen.getByRole('button', { name: 'Typing only' }));
    speak(700);
    expect(screen.getAllByText('I only read what you type.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(700);
    expect(bubble()).toHaveLength(1);
    expect(screen.queryByText('I only read what you type.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Photos are coming soon!').length).toBeGreaterThan(0);
  });

  it('takes the bubble away again and sends the companion home when the line is over', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(700);
    expect(bubble()).toHaveLength(1);
    expect(screen.getByLabelText('Lili stage')).toHaveAttribute('data-guided-state', 'away');
    speak(10_000);
    expect(bubble()).toHaveLength(0);
    expect(screen.getByLabelText('Lili stage')).toHaveAttribute('data-guided-state', 'none');
  });

  it('stops the line when the child feeds the companion', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(700);
    fireEvent.pointerDown(screen.getByText('stage companion'));
    expect(bubble()).toHaveLength(0);
  });

  it('shows the running session as a chip with its state in words and a way back', () => {
    renderHome({ session: { task: 'Apples', state: 'listening', href: '/session/1' } });
    const chip = screen.getByRole('link', { name: 'Go back to Apples' });
    expect(chip).toHaveTextContent('Apples: listening');
    expect(chip).toHaveAttribute('href', '/session/1');
  });

  it('says calmly that there is no internet, and never says anything was saved', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    renderHome();
    expect(screen.getAllByText('No internet right now').length).toBeGreaterThan(0);
    speak(800);
    expect(screen.getAllByText('No internet. I will wait for you.').length).toBeGreaterThan(0);
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
  });

  it('shows the typing-only chip only when voice is off', () => {
    renderHome();
    expect(screen.queryByRole('button', { name: 'Typing only' })).not.toBeInTheDocument();
    document.body.innerHTML = '';
    renderHome({ hasVoice: false });
    expect(screen.getByRole('button', { name: 'Typing only' })).toBeVisible();
  });

  it('does not move in calm mode: a ring marks the card and the bubble still speaks', () => {
    stubMotion(true);
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(100);
    expect(bubble()).toHaveLength(1);
    expect(document.querySelector('[data-guide-copy]')).toBeNull();
    expect(document.querySelector('[data-guide-target="task"]')).toHaveAttribute(
      'data-guided',
      'true',
    );
    // The stage only steps aside for its own line, never for a card's.
    expect(screen.getByLabelText('Lili stage')).toHaveAttribute('data-guided-state', 'none');
  });

  it('greets the child once on arrival with one short line, and not again on a quick return', () => {
    window.sessionStorage.clear();
    const ui = renderHome();
    expect(bubble()).toHaveLength(0);
    speak(1000);
    expect(screen.getAllByText('Hello! I am glad you are here.').length).toBeGreaterThan(0);
    speak(10_000);
    expect(bubble()).toHaveLength(0);

    document.body.innerHTML = '';
    render(ui);
    speak(1000);
    expect(bubble()).toHaveLength(0);
  });

  it('welcomes the child back, pointing at the waiting task, when one is unfinished', () => {
    window.sessionStorage.clear();
    renderHome({
      unfinished: {
        title: 'Apples',
        area: 'Maths',
        lastStep: 'Counting',
        updatedAt: '2026-01-15T08:00:00.000Z',
        href: '/session/1',
      },
    });
    speak(2000);
    expect(screen.getAllByText('Welcome back! Shall we keep going?').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Continue: Apples/ })).toHaveAttribute(
      'data-guided',
      'true',
    );
  });

  it('does not greet by name or by time of day: the page shows one greeting', () => {
    window.sessionStorage.clear();
    renderHome();
    speak(1500);
    expect(screen.queryByText(/Mia!/, { selector: 'p' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Good (morning|evening)|Guten (Morgen|Abend)/);
  });

  it('says it does not know the time when a limit is set but nothing is measured', () => {
    renderHome({ controls: { dailyLimitMinutes: 30, allowedWindow: null } });
    expect(screen.getByText('Time is not shown yet')).toBeVisible();
    expect(screen.queryByText(/unlimited/i)).not.toBeInTheDocument();
  });

  it('pauses new tasks outside the allowed hours, kindly, and keeps the companion and world open', () => {
    renderHome({
      controls: { dailyLimitMinutes: null, allowedWindow: { fromMinute: 900, untilMinute: 1080 } },
    });
    expect(screen.getAllByText(/Lili is sleeping until 3:00 PM\./).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Take a photo' })).toBeDisabled();
    expect(screen.getByText(/You can still feed Lili and see your world\./)).toBeVisible();
    expect(screen.getByRole('link', { name: /world/i })).toBeVisible();
    expect(document.querySelector('[data-guide-target="stage"]')).not.toHaveAttribute('inert');
    expect(document.body.innerHTML).not.toMatch(/danger/);
  });

  it('gives a heads-up in the last minutes, in words, and has the companion say it once', () => {
    renderHome({
      controls: { dailyLimitMinutes: null, allowedWindow: { fromMinute: 600, untilMinute: 667 } },
    });
    speak(121_500);
    expect(screen.getAllByText(/Almost break time/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Almost break time. Finish this step!').length).toBeGreaterThan(0);
  });

  it('opens the separate parent gate without rendering parent controls on Home', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: 'Grown-ups area' }));
    expect(navigate).toHaveBeenCalledWith('/parent');
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument();
  });
});

describe('HomeScreen voice', () => {
  const clip = () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 });
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve(clip()));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal(
      'Audio',
      class {
        play = () => Promise.resolve();
        pause = vi.fn();
      },
    );
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
  });

  const phrases = () =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body));

  it('says the greeting in its own voice, naming a fixed line and never sending words', async () => {
    window.sessionStorage.clear();
    renderHome({ speech: { speakerId: 'lili', isAllowed: true } });
    speak(800);
    await act(async () => {
      await Promise.resolve();
    });
    expect(phrases()).toEqual([{ speakerId: 'lili', phrase: 'hello' }]);
  });

  it('says what it shows when a card is tapped', async () => {
    renderHome({ speech: { speakerId: 'lili', isAllowed: true } });
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(phrases()).toEqual([{ speakerId: 'lili', phrase: 'photoSoon' }]);
  });

  it('stays quiet, with no request, when sound is not allowed', async () => {
    window.sessionStorage.clear();
    renderHome({ speech: { speakerId: 'lili', isAllowed: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Take a photo' }));
    speak(1500);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getAllByText('Photos are coming soon!').length).toBeGreaterThan(0);
  });
});
