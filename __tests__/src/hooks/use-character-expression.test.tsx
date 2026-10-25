import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useCharacterExpression,
  type CharacterExpressionInput,
} from '@hooks/use-character-expression';

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

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

function setup(input: CharacterExpressionInput) {
  return renderHook((props: CharacterExpressionInput) => useCharacterExpression(props), {
    initialProps: input,
  });
}

describe('useCharacterExpression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubMotion(false);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    setVisibility('visible');
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['motion'];
  });

  it('gets sleepier from level 0 to level 4', () => {
    const lids = ([0, 1, 2, 3, 4] as const).map(
      (boredomLevel) => setup({ boredomLevel }).result.current.expression.lids,
    );
    expect(lids).toEqual([0, 0.15, 0.35, 0.55, 0.7]);
  });

  it('adds z at level 2, a slump from level 3 and a cool tint only at level 4', () => {
    const at = (boredomLevel: 0 | 1 | 2 | 3 | 4) =>
      setup({ boredomLevel }).result.current.expression;
    expect(at(1).eyes).toBe('open');
    expect(at(2).eyes).toBe('sleepy');
    expect([at(2).slump, at(3).slump, at(4).slump]).toEqual([0, 0.65, 1]);
    expect([at(3).cool, at(4).cool]).toEqual([0, 1]);
  });

  it('lets a reaction win over boredom at once and gives it back afterwards', () => {
    const { result, rerender } = setup({ boredomLevel: 4 });
    expect(result.current.expression.slump).toBe(1);

    rerender({ boredomLevel: 4, reaction: 'pending' });
    expect(result.current.expression).toMatchObject({ mouthOpen: true, lids: 0, slump: 0 });
    rerender({ boredomLevel: 4, reaction: 'chew' });
    expect(result.current.expression).toMatchObject({ eyes: 'happy', chewing: true, lids: 0 });
    rerender({ boredomLevel: 0, reaction: 'cheer' });
    expect(result.current.expression).toMatchObject({ eyes: 'happy', lids: 0 });
    rerender({ boredomLevel: 0 });
    expect(result.current.expression.eyes).toBe('open');
  });

  it('blinks now and then, and yawns when it is very bored', () => {
    const { result } = setup({ boredomLevel: 4 });
    const seen = new Set<string>();
    for (let step = 0; step < 90; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      const { lids, yawning } = result.current.expression;
      if (yawning === true) {
        seen.add('yawn');
      }
      if (lids === 1) {
        seen.add('blink');
      }
    }
    expect(seen).toEqual(new Set(['yawn', 'blink']));
  });

  it('never yawns when only slightly sleepy, and does not look around', () => {
    const { result } = setup({ boredomLevel: 2 });
    for (let step = 0; step < 150; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.expression.yawning).toBe(false);
      expect(result.current.expression.look).toBeUndefined();
    }
  });

  it('clears every timer on unmount and when the reaction takes over', () => {
    const { unmount, rerender } = setup({ boredomLevel: 4 });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    rerender({ boredomLevel: 4, reaction: 'happy' });
    expect(vi.getTimerCount()).toBe(0);
    rerender({ boredomLevel: 4 });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses while the tab is hidden and resumes when it is shown', () => {
    const { result } = setup({ boredomLevel: 4 });
    setVisibility('hidden');
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.expression.yawning).toBe(false);
    setVisibility('visible');
    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('pauses while the element is off-screen', () => {
    let notify: (entries: Array<Pick<IntersectionObserverEntry, 'isIntersecting'>>) => void = () =>
      undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const { result, unmount } = setup({ boredomLevel: 4 });
    act(() => {
      result.current.ref(document.createElement('div'));
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => {
      notify([{ isIntersecting: false }]);
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      notify([{ isIntersecting: true }]);
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => {
      result.current.ref(null);
    });
    expect(disconnect).toHaveBeenCalled();
    unmount();
  });

  it('is static in calm mode: the resting pose of the level and no timers', () => {
    stubMotion(true);
    const { result } = setup({ boredomLevel: 3 });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.expression).toMatchObject({
      lids: 0.55,
      yawning: false,
      look: 'center',
      slump: 0.65,
    });
  });
});
