'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';

import { INITIAL_GUIDE, guideReducer } from './guide-reducer';
import { useCalmMotion } from './use-calm-motion';

import type { GuideState } from './guide-reducer';

/** How long a walk takes; the screen's transform transition lasts the same. */
export const GUIDE_WALK_MS = 700;

interface PointOptions {
  /** How long the line stays up once it is said (`dwellMsFor` of its text). */
  readonly dwellMs: number;
  /** False when the target is the guide's own home spot. Calm mode never moves it either way. */
  readonly moves?: boolean;
}

export interface Guide {
  readonly state: GuideState;
  /** Walks to `target` and says `line`; replaces whatever it was doing. Never blocks the tap that called it. */
  readonly pointAt: (target: string, line: string, options: PointOptions) => void;
  /** Cancels the line and goes home. */
  readonly stop: () => void;
}

/**
 * Drives `guideReducer` with the timers its phases need. The phases that wait (walking, speaking,
 * returning) end on their own; every new point or stop cancels the old timer, so a late timer can
 * not touch a newer line.
 */
export function useGuide(): Guide {
  const isCalm = useCalmMotion();
  const [state, dispatch] = useReducer(guideReducer, INITIAL_GUIDE);
  const [dwell, setDwell] = useState(0);
  const { phase, seq } = state;

  useEffect(() => {
    if (phase === 'home') {
      return undefined;
    }
    const wait = phase === 'speaking' ? dwell : GUIDE_WALK_MS;
    const event = { walking: 'arrived', speaking: 'spoken', returning: 'returned' } as const;
    const timer = window.setTimeout(() => {
      dispatch({ type: event[phase], seq });
    }, wait);
    return () => {
      window.clearTimeout(timer);
    };
  }, [phase, seq, dwell]);

  const pointAt = useCallback<Guide['pointAt']>(
    (target, line, { dwellMs, moves = true }) => {
      setDwell(dwellMs);
      dispatch({ type: 'point', target, line, moves: moves && !isCalm });
    },
    [isCalm],
  );
  const stop = useCallback(() => {
    dispatch({ type: 'stop' });
  }, []);

  return { state, pointAt, stop };
}
