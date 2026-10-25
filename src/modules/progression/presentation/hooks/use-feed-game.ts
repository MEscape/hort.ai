'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { useCalmMotion } from '@hooks/use-calm-motion';

import { useDailyReward } from './use-daily-reward';

import type { DailyReward } from './use-daily-reward';
import type { ProgressDto } from '../dto/progress-dto';

interface Point {
  readonly x: number;
  readonly y: number;
}

const ORIGIN: Point = { x: 0, y: 0 };
/** How long the food needs to reach the mouth when it was tapped. A picture of the path, never a wait for the server. */
const FLY_MS = 380;
/** How long the chewing lasts after a confirmed reward, and the cheer that follows a level-up. */
const CHEW_MS = 1800;
const CHEER_MS = 1100;
/** Movement below this many pixels is still a tap. */
const DRAG_THRESHOLD = 8;
/** The mouth counts as reached within this many pixels of its centre (or its own size, if bigger). */
const MIN_REACH = 56;

type Phase = 'tray' | 'dragging' | 'mouth';

/** What the companion does after a confirmed reward, one after the other; `null` once it is over. */
export type Celebration = 'chew' | 'cheer' | null;

function centerOf(element: Element): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

export interface FeedGame {
  readonly reward: DailyReward;
  /** Where the food is drawn: on the tray, under the finger, or at the mouth. */
  readonly place: Phase;
  readonly offset: Point;
  /** The food is over the mouth (dragging) or on its way / waiting there: the mouth opens. */
  readonly isMouthOpen: boolean;
  /** After the server confirmed the reward: chewing, then (only for a level-up) a cheer. Calm mode shows no motion. */
  readonly celebration: Celebration;
  /** Whether the food can be picked up (not while a claim is on its way, nor once today's is taken). */
  readonly canFeed: boolean;
  /** Callback refs: the game measures the food and the mouth when it is touched, never while drawing. */
  readonly attachFood: (element: HTMLButtonElement | null) => void;
  readonly attachMouth: (element: HTMLSpanElement | null) => void;
  /** Same call for a tap, the Enter key and a drop on the mouth. */
  readonly feed: () => void;
  readonly foodHandlers: {
    readonly onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
    readonly onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
    readonly onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
    readonly onPointerCancel: () => void;
    readonly onClick: () => void;
  };
}

interface DragState {
  readonly pointerId: number;
  readonly from: Point;
  readonly base: Point;
  hasMoved: boolean;
}

/**
 * The feeding game around the daily reward. Dragging the food to the mouth and tapping it are the
 * same act: both end in `claim`, the real Server Action, and nothing else (the keyboard's Enter and
 * Space are a tap). The motion only draws where the food is; whether a star was granted is decided
 * by the answer of the server, which is also what moves the chewing, the stars and the meter. A
 * failed claim sends the food back to the tray.
 */
export function useFeedGame(initial: ProgressDto): FeedGame {
  const reward = useDailyReward(initial);
  const isCalm = useCalmMotion();
  const [food, setFood] = useState<HTMLButtonElement | null>(null);
  const [mouth, setMouth] = useState<HTMLSpanElement | null>(null);
  const drag = useRef<DragState | null>(null);
  const flyTimer = useRef<number | undefined>(undefined);
  const ignoreClick = useRef(false);
  const [phase, setPhase] = useState<Phase>('tray');
  const [offset, setOffset] = useState<Point>(ORIGIN);
  const [isOverMouth, setIsOverMouth] = useState(false);
  const [beat, setBeat] = useState<'chew' | 'cheer' | 'over'>('chew');

  const isGranted = reward.status === 'granted';
  const place: Phase = reward.status === 'error' ? 'tray' : phase;
  const canFeed = (reward.status === 'available' || reward.status === 'error') && place !== 'mouth';

  useEffect(
    () => () => {
      window.clearTimeout(flyTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!isGranted || beat === 'over') {
      return undefined;
    }
    const timer = window.setTimeout(
      () => {
        setBeat(beat === 'chew' && reward.leveledUp ? 'cheer' : 'over');
      },
      beat === 'chew' ? CHEW_MS : CHEER_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [isGranted, beat, reward.leveledUp]);

  const sendToMouth = (base: Point, delay: number) => {
    if (mouth === null) {
      return;
    }
    setPhase('mouth');
    // Measured after the companion stopped idling (the open mouth ends the bobbing), so the food lands on the mouth.
    window.requestAnimationFrame(() => {
      const target = centerOf(mouth);
      setOffset({ x: target.x - base.x, y: target.y - base.y });
    });
    setIsOverMouth(false);
    window.clearTimeout(flyTimer.current);
    flyTimer.current = window.setTimeout(reward.claim, delay);
  };

  const isNearMouth = (pointer: Point) => {
    if (mouth === null) {
      return false;
    }
    const target = centerOf(mouth);
    const reach = Math.max(MIN_REACH, mouth.getBoundingClientRect().width);
    return Math.hypot(pointer.x - target.x, pointer.y - target.y) <= reach;
  };

  const backToTray = () => {
    drag.current = null;
    setPhase('tray');
    setOffset(ORIGIN);
    setIsOverMouth(false);
  };

  const feed = () => {
    if (canFeed && food !== null) {
      sendToMouth(centerOf(food), isCalm ? 0 : FLY_MS);
    }
  };

  return {
    reward,
    place,
    offset: place === 'tray' ? ORIGIN : offset,
    isMouthOpen: isOverMouth || (place === 'mouth' && !isGranted),
    celebration: isGranted && !isCalm && beat !== 'over' ? beat : null,
    canFeed,
    attachFood: setFood,
    attachMouth: setMouth,
    feed,
    foodHandlers: {
      onPointerDown: (event) => {
        if (!canFeed || event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          from: { x: event.clientX, y: event.clientY },
          base: centerOf(event.currentTarget),
          hasMoved: false,
        };
      },
      onPointerMove: (event) => {
        const current = drag.current;
        if (current?.pointerId !== event.pointerId) {
          return;
        }
        const dx = event.clientX - current.from.x;
        const dy = event.clientY - current.from.y;
        if (!current.hasMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
          return;
        }
        current.hasMoved = true;
        setPhase('dragging');
        setOffset({ x: dx, y: dy });
        setIsOverMouth(isNearMouth({ x: event.clientX, y: event.clientY }));
      },
      onPointerUp: (event) => {
        const current = drag.current;
        drag.current = null;
        if (current?.hasMoved !== true) {
          return;
        }
        ignoreClick.current = true;
        if (isNearMouth({ x: event.clientX, y: event.clientY })) {
          sendToMouth(current.base, 0);
        } else {
          backToTray();
        }
      },
      onPointerCancel: backToTray,
      onClick: () => {
        if (ignoreClick.current) {
          ignoreClick.current = false;
          return;
        }
        feed();
      },
    },
  };
}
