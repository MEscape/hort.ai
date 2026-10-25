import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tutorFace } from '@modules/tutors';

import { Character } from '@components/brand/character';
import { CharacterFaceOverlay } from '@components/brand/character-face';

const CLOSED = 'https://storage.test/tutors/max/mund-zu.svg';
const OPEN = 'https://storage.test/tutors/max/mund-auf.svg';
const FACE = tutorFace('max')!;

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

function lidShift(container: HTMLElement): number {
  const lid = container.querySelector('path[data-lids]');
  const match = /translateY\((-?[\d.e-]+)px\)/.exec(lid?.getAttribute('style') ?? '');
  return Number(match?.[1]);
}

function openMouth() {
  return document.querySelector<HTMLImageElement>('img[aria-hidden="true"]');
}

function overlay(expression: Parameters<typeof CharacterFaceOverlay>[0]['expression']) {
  return render(<CharacterFaceOverlay frame={FACE.closed} face={FACE} expression={expression} />);
}

describe('CharacterFaceOverlay', () => {
  beforeEach(() => {
    stubMotion(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('slides the lid further down the higher its level, and clears the eye when shut', () => {
    const shifts = [0, 0.15, 0.35, 0.55, 0.7, 1].map((lids) => {
      const { container, unmount } = overlay({ lids });
      const shift = lidShift(container);
      unmount();
      return shift;
    });
    expect(shifts).toEqual([...shifts].sort((a, b) => a - b));
    expect(new Set(shifts).size).toBe(shifts.length);
    expect(shifts[0]).toBe(0);
    // shut: the lid has travelled at least the eye's whole height
    expect(shifts.at(-1)).toBeGreaterThan(FACE.closed.eyes[0].box[3]);
  });

  it('clamps nonsense lid levels', () => {
    const shut = overlay({ lids: 7 });
    const reference = overlay({ lids: 1 });
    expect(lidShift(shut.container)).toBe(lidShift(reference.container));
  });

  it('repaints the pupil only when the eyes look somewhere, and draws ^^ for happy', () => {
    const plain = overlay({ eyes: 'open' });
    expect(plain.container.querySelectorAll('circle')).toHaveLength(0);
    plain.unmount();

    const looking = overlay({ look: 'left' });
    expect(looking.container.querySelectorAll('circle')).toHaveLength(4);
    looking.unmount();

    const happy = overlay({ eyes: 'happy' });
    expect(happy.container.querySelectorAll('path[stroke-linecap="round"]')).toHaveLength(4);
  });

  it('floats the z only while sleepy, and holds still in calm mode', () => {
    const sleepy = overlay({ eyes: 'sleepy' });
    expect(screen.getByTestId('character-zzz')).toHaveClass('animate-face-zzz');
    sleepy.unmount();

    stubMotion(true);
    overlay({ eyes: 'sleepy' });
    expect(screen.getByTestId('character-zzz')).not.toHaveClass('animate-face-zzz');
  });
});

describe('Character with an expression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMotion(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is only the picture without face geometry', () => {
    const { container } = render(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} expression={{ lids: 0.5 }} alt="Max" />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('img', { name: 'Max' })).toBeVisible();
  });

  it('is only the picture without an expression', () => {
    const { container } = render(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} face={FACE} alt="Max" />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('lays a face over each picture and shows the one that matches the visible mouth', () => {
    const { container } = render(
      <Character
        imageUrl={CLOSED}
        openImageUrl={OPEN}
        face={FACE}
        expression={{ lids: 0.3, yawning: true }}
        alt="Max"
      />,
    );
    const [closed, open] = Array.from(container.querySelectorAll('svg'));
    expect(closed).toHaveClass('opacity-0');
    expect(open).not.toHaveClass('opacity-0');
    expect(openMouth()).toHaveClass('opacity-100');
  });

  it('holds the mouth open while waiting, and chews in turn', () => {
    const { rerender } = render(
      <Character
        imageUrl={CLOSED}
        openImageUrl={OPEN}
        expression={{ mouthOpen: true }}
        alt="Max"
      />,
    );
    expect(openMouth()).toHaveClass('opacity-100');

    rerender(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} expression={{ chewing: true }} alt="Max" />,
    );
    const seen = new Set<string>();
    for (let tick = 0; tick < 10; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(110);
      });
      seen.add(openMouth()?.className.includes('opacity-100') === true ? 'open' : 'shut');
    }
    expect(seen).toEqual(new Set(['open', 'shut']));

    rerender(<Character imageUrl={CLOSED} openImageUrl={OPEN} alt="Max" />);
    expect(openMouth()).toHaveClass('opacity-0');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not chew in calm mode: a still, closed mouth', () => {
    stubMotion(true);
    render(
      <Character imageUrl={CLOSED} openImageUrl={OPEN} expression={{ chewing: true }} alt="Max" />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(openMouth()).toHaveClass('opacity-0');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('slumps and cools only when asked to, with a static filter', () => {
    const { container, rerender } = render(
      <Character imageUrl={CLOSED} expression={{ slump: 1, cool: 1 }} alt="Max" />,
    );
    const pose = container.querySelector<HTMLElement>('span > span');
    expect(pose?.style.transform).toBe('rotate(6deg) translateY(5%)');
    expect(pose?.style.filter).toContain('saturate(0.78)');
    expect(pose?.style.transition).not.toContain('filter');

    rerender(<Character imageUrl={CLOSED} expression={{}} alt="Max" />);
    expect(container.querySelector<HTMLElement>('span > span')?.getAttribute('style')).toBeNull();
  });
});
