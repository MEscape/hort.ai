'use client';

/* eslint-disable no-magic-numbers -- the mouth rhythm is a table of milliseconds */

import { useEffect, useState } from 'react';

import { useCalmMotion } from './use-calm-motion';

/** How long the mouth stays open and shut, in turn. Uneven on purpose: an even beat looks mechanical. */
const OPEN_MS = [110, 90, 140, 80, 120, 100, 150, 85] as const;
const SHUT_MS = [70, 100, 55, 90, 60, 80, 65, 95] as const;
/* eslint-enable no-magic-numbers -- the tables end here */

/**
 * Whether the mouth of a speaking character is open right now. Two pictures (open, closed) are all
 * a character has, so the mouth alternates in an uneven rhythm while `isSpeaking`. With reduced
 * motion it simply stays open for as long as the character speaks: the state is still readable, nothing
 * flickers. It re-renders only the component that calls it, never a whole screen.
 */
export function useLipSync(isSpeaking: boolean): boolean {
  const [step, setStep] = useState(0);
  const isCalm = useCalmMotion();

  useEffect(() => {
    if (!isSpeaking || isCalm) {
      return undefined;
    }
    let current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      current += 1;
      setStep(current);
      const table = current % 2 === 0 ? OPEN_MS : SHUT_MS;
      timer = setTimeout(next, table[Math.floor(current / 2) % table.length]);
    };
    timer = setTimeout(next, OPEN_MS[0]);
    return () => {
      clearTimeout(timer);
      setStep(0);
    };
  }, [isSpeaking, isCalm]);

  if (!isSpeaking) {
    return false;
  }
  return isCalm || step % 2 === 0;
}
