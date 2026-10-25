import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCarousel, useHappyBeat } from '@hooks/use-carousel';

describe('useHappyBeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not happy before anything was chosen', () => {
    const { result } = renderHook(() => useHappyBeat(0));
    expect(result.current).toBe(false);
  });

  it('smiles for a moment after each choice and then goes back to normal', () => {
    const { result, rerender } = renderHook(({ token }) => useHappyBeat(token), {
      initialProps: { token: 0 },
    });
    rerender({ token: 1 });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(false);
    rerender({ token: 2 });
    expect(result.current).toBe(true);
  });

  it('starts the moment over when another choice comes quickly, and clears its timer on unmount', () => {
    const { result, rerender, unmount } = renderHook(({ token }) => useHappyBeat(token), {
      initialProps: { token: 1 },
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    rerender({ token: 2 });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current).toBe(true);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('useCarousel', () => {
  it('counts every choice as a hop, also a tap on the active one, and does not wrap', () => {
    const onActiveChange = vi.fn();
    const { result } = renderHook(() =>
      useCarousel({ ids: ['a', 'b', 'c'], activeId: 'c', onActiveChange }),
    );
    expect(result.current.canStep(1)).toBe(false);
    act(() => {
      result.current.step(1);
    });
    expect(onActiveChange).not.toHaveBeenCalled();
    expect(result.current.hops).toBe(0);
    act(() => {
      result.current.goTo(2);
    });
    expect(onActiveChange).not.toHaveBeenCalled();
    expect(result.current.hops).toBe(1);
    act(() => {
      result.current.step(-1);
    });
    expect(onActiveChange).toHaveBeenCalledExactlyOnceWith('b');
  });
});
