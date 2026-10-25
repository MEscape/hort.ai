'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CharacterExpression } from '@components/brand/character-face';

import { useCalmMotion } from './use-calm-motion';

/** What the companion does right now because of something the child did. */
export type CharacterReaction = 'none' | 'pending' | 'chew' | 'happy' | 'cheer';

export interface CharacterExpressionInput {
  readonly boredomLevel?: BoredomLevel;
  readonly reaction?: CharacterReaction;
}

export interface CharacterExpressionResult {
  readonly expression: CharacterExpression;
  /** Put it on the element around the character: off-screen, the idle animation pauses. */
  readonly ref: (element: Element | null) => void;
}

/** A range of milliseconds to pick a random delay from. */
interface Span {
  readonly min: number;
  readonly max: number;
}

interface Level {
  readonly lids: number;
  readonly slump: number;
  readonly cool: number;
  readonly blinkMs: Span;
  /** Time between two yawns; `undefined` = never. */
  readonly yawnMs?: Span;
  readonly looksAround: boolean;
  readonly hasZzz: boolean;
}

const LIVELY: Span = { min: 2800, max: 5200 };
const RELAXED: Span = { min: 3400, max: 6000 };
const SLOW: Span = { min: 4200, max: 7000 };

/** The ladder from lively to very bored; a table of tuning values. */
const LEVELS = {
  0: { lids: 0, slump: 0, cool: 0, blinkMs: LIVELY, looksAround: false, hasZzz: false },
  1: { lids: 0.15, slump: 0, cool: 0, blinkMs: RELAXED, looksAround: false, hasZzz: false },
  2: { lids: 0.35, slump: 0, cool: 0, blinkMs: SLOW, looksAround: false, hasZzz: true },
  3: {
    lids: 0.55,
    slump: 0.65,
    cool: 0,
    blinkMs: SLOW,
    yawnMs: { min: 5200, max: 7200 },
    looksAround: true,
    hasZzz: false,
  },
  4: {
    lids: 0.7,
    slump: 1,
    cool: 1,
    blinkMs: SLOW,
    yawnMs: { min: 4200, max: 5800 },
    looksAround: true,
    hasZzz: false,
  },
} as const satisfies Record<number, Level>;

/** 0 = lively ... 4 = very bored. Derived from how many days the child was away, never stored. */
export type BoredomLevel = keyof typeof LEVELS;

const BLINK_MS = 150;
const YAWN_MS = 1700;
const YAWN_LIDS = 0.92;
const LOOK_MS: Span = { min: 1800, max: 3400 };

type Look = NonNullable<CharacterExpression['look']>;
const LOOKS: readonly Look[] = ['left', 'right', 'center'];

function between({ min, max }: Span): number {
  return min + Math.random() * (max - min);
}

function lidsOf(
  level: Level,
  { isYawning, isBlinking }: { isYawning: boolean; isBlinking: boolean },
): number {
  if (isYawning) {
    return YAWN_LIDS;
  }
  return isBlinking ? 1 : level.lids;
}

/** True while the tab is shown. */
function usePageVisible(): boolean {
  const [isVisible, setIsVisible] = useState(true);
  useEffect(() => {
    const update = () => {
      setIsVisible(document.visibilityState !== 'hidden');
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return isVisible;
}

/** A callback ref and whether the element is in view (always true without IntersectionObserver). */
function useInView(): [(element: Element | null) => void, boolean] {
  const [isInView, setIsInView] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const ref = useCallback((element: Element | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element === null || typeof IntersectionObserver === 'undefined') {
      return;
    }
    observer.current = new IntersectionObserver((entries) => {
      const last = entries.at(-1);
      if (last !== undefined) {
        setIsInView(last.isIntersecting);
      }
    });
    observer.current.observe(element);
  }, []);
  return [ref, isInView];
}

const REACTIONS: Readonly<Record<Exclude<CharacterReaction, 'none'>, CharacterExpression>> = {
  pending: { eyes: 'open', lids: 0, mouthOpen: true },
  chew: { eyes: 'happy', lids: 0, chewing: true },
  happy: { eyes: 'happy', lids: 0 },
  cheer: { eyes: 'happy', lids: 0 },
};

/**
 * The face a companion shows: the sleepy-to-bored ladder from `boredomLevel` (lids lower, a slump, a
 * yawn every few seconds, eyes drifting aside) or, while the child does something, a reaction (waits
 * with an open mouth, chews, happy ^^ eyes) that wins over boredom at once. Idle timers (blink,
 * yawn, looking around) run only when the tab is shown and the element is in view; calm mode and
 * reduced motion get the resting pose of the level and no timers at all. Timers are cleared on
 * every change and on unmount.
 */
export function useCharacterExpression({
  boredomLevel = 0,
  reaction = 'none',
}: CharacterExpressionInput = {}): CharacterExpressionResult {
  const isCalm = useCalmMotion();
  const isVisible = usePageVisible();
  const [ref, isInView] = useInView();
  const [isBlinking, setIsBlinking] = useState(false);
  const [isYawning, setIsYawning] = useState(false);
  const [look, setLook] = useState<Look>('center');
  const level: Level = LEVELS[boredomLevel];
  const isIdle = reaction === 'none';
  const isActive = isIdle && !isCalm && isVisible && isInView;

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let isStopped = false;
    const later = (action: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!isStopped) {
          action();
        }
      }, ms);
      timers.add(timer);
    };
    const blink = () => {
      setIsBlinking(true);
      later(() => {
        setIsBlinking(false);
        later(blink, between(level.blinkMs));
      }, BLINK_MS);
    };
    const yawn = () => {
      setIsYawning(true);
      later(() => {
        setIsYawning(false);
        if (level.yawnMs !== undefined) {
          later(yawn, between(level.yawnMs));
        }
      }, YAWN_MS);
    };
    const glance = () => {
      setLook((previous) => {
        const options = LOOKS.filter((option) => option !== previous);
        return options[Math.floor(Math.random() * options.length)] ?? 'center';
      });
      later(glance, between(LOOK_MS));
    };
    later(blink, between(level.blinkMs));
    if (level.yawnMs !== undefined) {
      later(yawn, between(level.yawnMs));
    }
    if (level.looksAround) {
      later(glance, between(LOOK_MS));
    }
    return () => {
      isStopped = true;
      timers.forEach(clearTimeout);
      setIsBlinking(false);
      setIsYawning(false);
      setLook('center');
    };
  }, [isActive, level]);

  const expression: CharacterExpression = isIdle
    ? {
        eyes: level.hasZzz ? 'sleepy' : 'open',
        lids: lidsOf(level, { isYawning, isBlinking }),
        ...(level.looksAround && { look: isActive ? look : ('center' as const) }),
        yawning: isYawning,
        slump: level.slump,
        cool: level.cool,
      }
    : { ...REACTIONS[reaction], slump: 0, cool: 0 };

  return { expression, ref };
}
