'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import type { CarouselDirection } from '@hooks/use-carousel-drag';

export interface CarouselOptions {
  readonly ids: readonly string[];
  readonly activeId: string;
  readonly onActiveChange: (id: string) => void;
}

const HOP_CLASS = 'animate-hop';

/**
 * The state behind a character carousel: the active one is the selection, and it changes through
 * the arrow keys, Home and End, previous and next, a tap on another slide, or a drag. `hops` counts
 * every such change (and a tap on the active one) so the active character can answer with a hop.
 * It does not wrap: the ends are real ends, which keeps "2 of 3" honest and the slides from
 * crossing the stage.
 */
export function useCarousel({ ids, activeId, onActiveChange }: CarouselOptions) {
  const baseId = useId();
  const activeIndex = Math.max(0, ids.indexOf(activeId));
  const [hops, setHops] = useState(0);

  const canStep = (direction: CarouselDirection) => {
    const target = activeIndex + direction;
    return target >= 0 && target < ids.length;
  };
  const goTo = (index: number) => {
    const target = ids[index];
    if (target === undefined) {
      return;
    }
    setHops((count) => count + 1);
    if (index !== activeIndex) {
      onActiveChange(target);
    }
  };
  const step = (direction: CarouselDirection) => {
    if (canStep(direction)) {
      goTo(activeIndex + direction);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => {
        step(-1);
      },
      ArrowRight: () => {
        step(1);
      },
      Home: () => {
        goTo(0);
      },
      End: () => {
        goTo(ids.length - 1);
      },
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      move();
    }
  };

  return {
    activeIndex,
    hops,
    canStep,
    goTo,
    step,
    onKeyDown,
    optionId: (id: string) => `${baseId}-${id}`,
  };
}

/**
 * Plays the hop of a character again each time `token` changes to something above zero (0 = never,
 * or calm). Restarting the CSS animation in place keeps the pictures mounted, where a new `key`
 * would reload them and flicker.
 */
export function useHop(token: number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (token === 0 || element === null) {
      return;
    }
    element.classList.remove(HOP_CLASS);
    element.getBoundingClientRect(); // a read in between makes the browser start the animation over
    element.classList.add(HOP_CLASS);
  }, [token]);
  return ref;
}

const HAPPY_MS = 1100;

/**
 * True for a moment each time `token` changes to something above zero: the character that was just
 * chosen smiles with closed eyes (^^). It is a still face, so calm mode keeps it too.
 */
export function useHappyBeat(token: number) {
  const [isHappy, setIsHappy] = useState(false);
  useEffect(() => {
    if (token === 0) {
      return undefined;
    }
    setIsHappy(true);
    const timer = setTimeout(() => {
      setIsHappy(false);
    }, HAPPY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [token]);
  return isHappy;
}
