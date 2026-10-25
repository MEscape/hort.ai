'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { Star } from '@components/ui/icons';

import { useCalmMotion } from '@hooks/use-calm-motion';

const HALF = 2;

export interface StarFlightProps {
  /** The place the star sinks into (the meter), measured when the star appears. */
  readonly targetRef: RefObject<HTMLElement | null>;
}

/**
 * One star that rises from where it is drawn and sinks into the meter. Mount it only after the
 * server confirmed the reward: it is a picture of a result, not part of getting it. The distance
 * is measured in the browser once, so it lands in the meter on any screen size. With reduced motion
 * or calm mode nothing is drawn: the text and the meter already say it.
 */
export function StarFlight({ targetRef }: StarFlightProps) {
  const isCalm = useCalmMotion();
  const [hasLanded, setHasLanded] = useState(false);
  const starRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const star = starRef.current;
    const target = targetRef.current?.getBoundingClientRect();
    if (star === null || target === undefined) {
      return;
    }
    const from = star.getBoundingClientRect();
    star.style.setProperty(
      '--fly-x',
      `${target.left + target.width / HALF - (from.left + from.width / HALF)}px`,
    );
    star.style.setProperty(
      '--fly-y',
      `${target.top + target.height / HALF - (from.top + from.height / HALF)}px`,
    );
  }, [targetRef, isCalm]);

  if (isCalm || hasLanded) {
    return null;
  }
  return (
    <span
      ref={starRef}
      aria-hidden="true"
      data-star-flight=""
      className="pointer-events-none absolute inset-0 z-10 flex animate-star-fly items-center justify-center text-accent"
      onAnimationEnd={() => {
        setHasLanded(true);
      }}
    >
      <Star className="size-10 fill-current" />
    </span>
  );
}
