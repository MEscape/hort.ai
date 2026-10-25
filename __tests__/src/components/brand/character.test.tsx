import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Character } from '@components/brand/character';

const CLOSED = 'https://storage.test/tutors/max/mund-zu.svg';
const OPEN = 'https://storage.test/tutors/max/mund-auf.svg';

function openMouth() {
  return document.querySelector<HTMLImageElement>('img[aria-hidden="true"]');
}

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

describe('Character', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['motion'];
  });

  it('shows the closed mouth at rest and names the picture', () => {
    render(<Character imageUrl={CLOSED} openImageUrl={OPEN} alt="Max, Hund" />);
    expect(screen.getByRole('img', { name: 'Max, Hund' })).toHaveAttribute('src', CLOSED);
    expect(openMouth()).toHaveClass('opacity-0');
  });

  it('opens and closes the mouth in turn while it speaks, and rests again when it stops', () => {
    const { rerender } = render(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} isSpeaking alt="Max" />,
    );
    const seen = new Set<string>();
    for (let tick = 0; tick < 12; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(60);
      });
      seen.add(openMouth()?.className.includes('opacity-100') === true ? 'open' : 'shut');
    }
    expect(seen).toEqual(new Set(['open', 'shut']));

    rerender(<Character imageUrl={CLOSED} openImageUrl={OPEN} isSpeaking={false} alt="Max" />);
    expect(openMouth()).toHaveClass('opacity-0');
  });

  it('keeps the mouth still, and open, with reduced motion', () => {
    stubMotion(true);
    render(<Character imageUrl={CLOSED} openImageUrl={OPEN} isSpeaking alt="Max" />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(openMouth()).toHaveClass('opacity-100');
  });

  it('keeps the mouth still with the in-app calm setting', () => {
    document.documentElement.dataset['motion'] = 'calm';
    render(<Character imageUrl={CLOSED} openImageUrl={OPEN} isSpeaking alt="Max" />);
    expect(openMouth()).toHaveClass('opacity-100');
  });

  it('cannot lip-sync without an open-mouth picture and just stays closed', () => {
    render(<Character imageUrl={CLOSED} isSpeaking alt="Max" />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(openMouth()).toBeNull();
    expect(screen.getByRole('img', { name: 'Max' })).toBeVisible();
  });

  it('lays the open-mouth picture over the closed one when they are framed differently', () => {
    render(
      <Character
        imageUrl={CLOSED}
        openImageUrl={OPEN}
        openAlignment={{ scaleX: 0.9, scaleY: 0.8, x: 0.05, y: -0.02 }}
        alt="Max"
      />,
    );
    expect(openMouth()).toHaveStyle({
      transform: 'translate(5%, -2%) scale(0.9, 0.8)',
      transformOrigin: '0 0',
    });
  });

  it('shows a calm paw instead of a broken picture when the picture is missing', () => {
    render(<Character imageUrl={CLOSED} alt="Max" />);
    fireEvent.error(screen.getByRole('img', { name: 'Max' }));
    expect(screen.queryByRole('img', { name: 'Max' })).not.toBeInTheDocument();

    render(<Character imageUrl="" alt="Lili" />);
    expect(screen.queryByRole('img', { name: 'Lili' })).not.toBeInTheDocument();
  });

  it('paints no background of its own: not around the pictures, not around the paw', () => {
    const { container } = render(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} alt="Max" className="size-40" />,
    );
    expect(container.innerHTML).not.toContain('bg-');
    fireEvent.error(screen.getByRole('img', { name: 'Max' }));
    expect(container.innerHTML).not.toContain('bg-');
  });

  it('draws the pictures in the server-rendered page, so the browser loads them early', () => {
    const html = renderToString(<Character imageUrl={CLOSED} openImageUrl={OPEN} alt="Max" />);
    expect(html).toContain(CLOSED);
    expect(html).toContain(OPEN);
  });

  it('shows the paw when the picture had already failed before React could listen', async () => {
    const decode = vi.fn(() => Promise.reject(new Error('broken')));
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      value: decode,
      configurable: true,
    });
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    render(<Character imageUrl={CLOSED} alt="Max" />);
    await vi.waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Max' })).not.toBeInTheDocument();
    });
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  });

  it('keeps the mouth shut, and the closed picture shown, until the open picture is loaded', async () => {
    vi.useRealTimers();
    stubMotion(false);
    let finish: () => void = () => undefined;
    const decode = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      value: decode,
      configurable: true,
    });
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    render(<Character imageUrl={CLOSED} openImageUrl={OPEN} isSpeaking alt="Max" />);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByRole('img', { name: 'Max' })).not.toHaveClass('opacity-0');
    expect(openMouth()).toHaveClass('opacity-0');
    await act(async () => {
      finish();
      await Promise.resolve();
    });
    await vi.waitFor(() => {
      expect(openMouth()).toHaveClass('opacity-100');
    });
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
    vi.restoreAllMocks();
  });
});
