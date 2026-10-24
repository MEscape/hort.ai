'use client';

import { useEffect, useState } from 'react';

const MS_PER_SECOND = 1000;

export interface Countdown {
  /** Whole seconds left; 0 once the wait is over. */
  readonly secondsLeft: number;
  /** Start the wait again from the full length. */
  readonly restart: () => void;
}

/**
 * A wait that counts down in whole seconds, starting now: for "send again in 42 s". The timer is
 * stopped when the wait is over or the component goes away.
 */
export function useCountdown(seconds: number): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, MS_PER_SECOND);
    return () => {
      clearTimeout(timer);
    };
  }, [secondsLeft]);

  return {
    secondsLeft,
    restart: () => {
      setSecondsLeft(seconds);
    },
  };
}
