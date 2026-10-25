import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScreenTime } from '@/app/[locale]/(app)/home/_components/use-screen-time';

/** 17:50 in Berlin in winter. */
const SERVER_NOW = '2026-01-15T16:50:00.000Z';
const controls = { dailyLimitMinutes: null, allowedWindow: { fromMinute: 900, untilMinute: 1080 } };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useScreenTime', () => {
  it('starts from the server time it was given, not from the device clock', () => {
    vi.setSystemTime(new Date('2030-06-01T03:00:00Z'));
    const { result } = renderHook(() =>
      useScreenTime({ controls, serverNow: SERVER_NOW, usedMinutes: null }),
    );
    expect(result.current).toMatchObject({ status: 'open', minutesLeft: 10 });
  });

  it('becomes low and then closed as the time passes, without a reload', () => {
    const { result } = renderHook(() =>
      useScreenTime({ controls, serverNow: SERVER_NOW, usedMinutes: null }),
    );
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(result.current.status).toBe('low');
    act(() => {
      vi.advanceTimersByTime(5 * 60_000);
    });
    expect(result.current.status).toBe('closed_outside_window');
  });
});
