import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoicePreview } from '@components/shared/voice-preview';
import type { VoicePreviewProps } from '@components/shared/voice-preview';

import { FakeAudio, soundsPlaying, stubAudio, stubMotion } from './fake-audio';

const LABELS = {
  play: 'Hear Max',
  stop: 'Stop',
  retry: 'Try again',
  loading: 'Getting ready…',
  speaking: 'Max is speaking…',
  unavailable: 'There is no sound right now.',
  failed: 'That did not play.',
  progress: 'How much has played',
};
const A = 'https://storage.test/max.mp3';
const B = 'https://storage.test/lili.mp3';

function preview(props: Partial<VoicePreviewProps> = {}) {
  return (
    <VoicePreview
      url={A}
      imageUrl="/max.svg"
      imageOpenUrl="/max-open.svg"
      labels={LABELS}
      {...props}
    />
  );
}

function last(): FakeAudio {
  const audio = FakeAudio.instances.at(-1);
  if (audio === undefined) {
    throw new Error('no audio element was created');
  }
  return audio;
}

const press = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};
const mouth = () => document.querySelector('img[aria-hidden="true"]');
const progress = () => screen.getByRole('progressbar', { hidden: true });

describe('VoicePreview', () => {
  beforeEach(() => {
    stubAudio();
    stubMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('waits for a press: nothing is created or played by itself', () => {
    render(preview());
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeEnabled();
    expect(FakeAudio.instances).toHaveLength(0);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows a loading state until the sound runs, then listening with progress and a speaking mouth', () => {
    vi.useFakeTimers();
    render(preview());
    press('Hear Max');
    expect(last().url).toBe(A);
    expect(screen.getByRole('status')).toHaveTextContent('Getting ready…');
    expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible();

    act(() => {
      last().onplaying?.();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Max is speaking…');
    last().currentTime = 5;
    act(() => {
      last().ontimeupdate?.();
    });
    expect(progress()).toHaveAttribute('aria-valuenow', '50');

    const seen = new Set<string>();
    for (let tick = 0; tick < 12; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(60);
      });
      seen.add(mouth()?.className.includes('opacity-100') === true ? 'open' : 'shut');
    }
    expect(seen).toEqual(new Set(['open', 'shut']));
    expect(document.querySelector('.animate-ripple')).toBeInTheDocument();
    expect(document.querySelectorAll('.animate-bars')).toHaveLength(8);
  });

  it('keeps the mouth shut while the sound is still loading', () => {
    render(preview());
    press('Hear Max');
    expect(mouth()).toHaveClass('opacity-0');
  });

  it('stops on a second press and goes back to the start', () => {
    render(preview());
    press('Hear Max');
    act(() => {
      last().onplaying?.();
    });
    press('Stop');
    expect(last().pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeVisible();
    expect(progress()).toHaveAttribute('aria-valuenow', '0');
    expect(soundsPlaying()).toBe(0);
  });

  it('is ready to play again when the sound has ended', () => {
    render(preview());
    press('Hear Max');
    act(() => {
      last().onended?.();
    });
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeVisible();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('says so in words and offers a retry when the sound fails, and the retry plays again', () => {
    render(preview());
    press('Hear Max');
    act(() => {
      last().onerror?.();
    });
    expect(screen.getByRole('status')).toHaveTextContent('That did not play.');
    press('Try again');
    expect(FakeAudio.instances).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Getting ready…');
  });

  it('also treats a refused play() as a failure', async () => {
    FakeAudio.nextPlay = () => Promise.reject(new Error('blocked'));
    render(preview());
    press('Hear Max');
    expect(await screen.findByText('That did not play.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('is unavailable, without a retry, when there is no sound file', () => {
    render(preview({ url: '' }));
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('There is no sound right now.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('never plays two sounds at once: a new address stops the old one first', () => {
    const { rerender } = render(preview());
    press('Hear Max');
    const first = last();
    expect(soundsPlaying()).toBe(1);

    rerender(preview({ url: B }));
    expect(first.pause).toHaveBeenCalled();
    expect(soundsPlaying()).toBe(0);
    expect(screen.getByRole('button', { name: 'Hear Max' })).toBeVisible();

    press('Hear Max');
    expect(last().url).toBe(B);
    expect(soundsPlaying()).toBe(1);
  });

  it('presses once, plays once: pressing again while it plays stops instead of stacking', () => {
    render(preview());
    press('Hear Max');
    press('Stop');
    press('Hear Max');
    expect(FakeAudio.instances).toHaveLength(1);
    expect(soundsPlaying()).toBe(1);
  });

  it('stops the sound when the screen is left', () => {
    const { unmount } = render(preview());
    press('Hear Max');
    const element = last();
    unmount();
    expect(element.pause).toHaveBeenCalled();
    expect(soundsPlaying()).toBe(0);
  });

  it('draws no pulsing ring with reduced motion but still says it speaks and opens the mouth', () => {
    stubMotion(true);
    render(preview());
    press('Hear Max');
    act(() => {
      last().onplaying?.();
    });
    expect(document.querySelector('.animate-ripple')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Max is speaking…');
    expect(mouth()).toHaveClass('opacity-100');
  });

  it('never changes the height of the page: the status hangs out of the flow, in every phase', () => {
    const { container } = render(preview());
    const statusFlow = () => screen.getByRole('status').className;
    // At rest it is only for a screen reader; while loading and after a failure it hangs below, absolute.
    expect(statusFlow()).toContain('sr-only');
    expect(container.firstElementChild).toHaveClass('relative');
    press('Hear Max');
    expect(statusFlow()).toContain('absolute');
    expect(statusFlow()).not.toMatch(/(^|s)min-h-/);
    act(() => {
      last().onplaying?.();
    });
    expect(statusFlow()).toContain('sr-only');
    act(() => {
      last().onerror?.();
    });
    expect(statusFlow()).toContain('absolute');
    expect(statusFlow()).not.toMatch(/(^|s)min-h-/);
  });

  it('paints nothing under the character: no ground shadow', () => {
    const { container } = render(preview());
    expect(container.querySelector('[class*="bg-primary/15"]')).not.toBeInTheDocument();
  });
});
