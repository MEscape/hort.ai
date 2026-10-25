'use client';

import { useEffect, useState } from 'react';

import { computeScreenTime } from '@modules/learner/client';
import type { ScreenTime } from '@modules/learner/client';

import { MS_PER_MINUTE } from '@lib/utils';

/** How often the screen re-reads the time: often enough for "5 minutes left" to appear on time. */
const TICK_MS = MS_PER_MINUTE / 2;

interface UseScreenTimeOptions {
  readonly controls: Parameters<typeof computeScreenTime>[0]['controls'];
  /** The server's clock when the page was rendered (ISO text). */
  readonly serverNow: string;
  readonly usedMinutes: number | null;
}

/**
 * The screen-time state, kept current in the browser. It starts at the server's time and moves on
 * with the monotonic clock, so a child changing the device's date or time cannot change it.
 */
export function useScreenTime({
  controls,
  serverNow,
  usedMinutes,
}: UseScreenTimeOptions): ScreenTime {
  const [origin] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(performance.now() - origin);
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [origin]);

  return computeScreenTime({
    controls,
    usedMinutes,
    now: new Date(Date.parse(serverNow) + elapsed),
  });
}
