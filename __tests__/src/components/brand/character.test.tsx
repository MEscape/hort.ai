import { act, fireEvent, render, screen } from '@testing-library/react';
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
});
