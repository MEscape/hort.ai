import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GUIDE_WALK_MS, useGuide } from '@hooks/use-guide';

const DWELL = 3000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset['motion'];
});

describe('useGuide', () => {
  it('walks, speaks, walks home and ends at home, on its own', () => {
    const { result } = renderHook(() => useGuide());

    act(() => {
      result.current.pointAt('teacher', 'teacher.empty', { dwellMs: DWELL });
    });
    expect(result.current.state.phase).toBe('walking');

    act(() => {
      vi.advanceTimersByTime(GUIDE_WALK_MS);
    });
    expect(result.current.state.phase).toBe('speaking');

    act(() => {
      vi.advanceTimersByTime(DWELL);
    });
    expect(result.current.state.phase).toBe('returning');

    act(() => {
      vi.advanceTimersByTime(GUIDE_WALK_MS);
    });
    expect(result.current.state).toMatchObject({ phase: 'home', line: null, target: null });
  });

  it('drops the line of an earlier tap when a new one comes in (its timers never fire)', () => {
    const { result } = renderHook(() => useGuide());
    act(() => {
      result.current.pointAt('teacher', 'a', { dwellMs: DWELL });
      vi.advanceTimersByTime(GUIDE_WALK_MS);
    });
    act(() => {
      vi.advanceTimersByTime(DWELL - 1);
      result.current.pointAt('world', 'b', { dwellMs: DWELL });
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toMatchObject({ phase: 'walking', line: 'b' });
  });

  it('stops: the bubble is gone and the timers of the line no longer run', () => {
    const { result } = renderHook(() => useGuide());
    act(() => {
      result.current.pointAt('teacher', 'a', { dwellMs: DWELL });
      vi.advanceTimersByTime(GUIDE_WALK_MS);
      result.current.stop();
    });
    expect(result.current.state).toMatchObject({ phase: 'returning', line: null });
  });

  it('does not move in calm mode: it speaks at once and is home when the line is over', () => {
    document.documentElement.dataset['motion'] = 'calm';
    const { result } = renderHook(() => useGuide());
    act(() => {
      result.current.pointAt('teacher', 'a', { dwellMs: DWELL });
    });
    expect(result.current.state).toMatchObject({ phase: 'speaking', hasMoved: false });
    act(() => {
      vi.advanceTimersByTime(DWELL);
    });
    expect(result.current.state.phase).toBe('home');
  });

  it('does not move when the target is its own home', () => {
    const { result } = renderHook(() => useGuide());
    act(() => {
      result.current.pointAt('stage', 'a', { dwellMs: DWELL, moves: false });
    });
    expect(result.current.state.phase).toBe('speaking');
  });

  it('clears its timer when the screen is left', () => {
    const { result, unmount } = renderHook(() => useGuide());
    act(() => {
      result.current.pointAt('teacher', 'a', { dwellMs: DWELL });
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
