'use client';

import { useState } from 'react';

import { INTERESTS } from '@modules/learner/client';
import type { Interest } from '@modules/learner/client';

/** What a tile just did, for one animation: it was chosen (a hop) or refused (a tiny shake). */
export interface TileFeedback {
  readonly interest: Interest;
  readonly kind: 'hop' | 'refused';
}

/**
 * The child's pick of favourites with a hard limit. A tile past the limit is refused (and shakes),
 * a chosen tile can always be tapped to free its place at once. `picks` counts the choices, so the
 * companion can hop each time.
 */
export function useInterestChoice(
  interests: readonly Interest[],
  onChange: (interests: readonly Interest[]) => void,
  max: number,
) {
  const [feedback, setFeedback] = useState<TileFeedback | null>(null);
  const [picks, setPicks] = useState(0);
  const isFull = interests.length >= max;

  const toggle = (interest: Interest) => {
    if (interests.includes(interest)) {
      onChange(interests.filter((item) => item !== interest));
      return;
    }
    if (isFull) {
      setFeedback({ interest, kind: 'refused' });
      return;
    }
    onChange(INTERESTS.filter((item) => item === interest || interests.includes(item)));
    setFeedback({ interest, kind: 'hop' });
    setPicks((count) => count + 1);
  };

  return {
    isFull,
    picks,
    feedback,
    toggle,
    clearFeedback: () => {
      setFeedback(null);
    },
  };
}
