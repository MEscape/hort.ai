'use client';

import { useEffect, useRef } from 'react';

/** Movement before a press counts as a drag: a tap on a touch screen always wobbles a little. */
const SLOP_PX = 8;
/** How far a drag must go to step to the next one. */
const STEP_PX = 48;
/** At the first or last one a drag only gives a little, so the end is felt. */
const EDGE_RESISTANCE = 0.25;

export type CarouselDirection = -1 | 1;

export interface CarouselDragOptions {
  readonly canStep: (direction: CarouselDirection) => boolean;
  readonly onStep: (direction: CarouselDirection) => void;
}

interface Gesture {
  readonly pointerId: number;
  readonly startX: number;
  deltaX: number;
  isDragging: boolean;
}

const directionOf = (deltaX: number): CarouselDirection => (deltaX < 0 ? 1 : -1);

/**
 * Pointer-event dragging for a carousel track (mouse, touch and pen alike); give the returned ref to
 * the track. While dragging it sets `--drag` (px) and `data-dragging` straight on the element, so
 * the slides follow the finger without a React render per move; on release it steps once when the
 * drag went far enough. The pointer is captured only after the slop, so a plain tap still reaches
 * the slide under it, and the click that ends a drag is swallowed. The listeners are native
 * (set up once); the latest `canStep` / `onStep` are read when an event arrives.
 */
export function useCarouselDrag(options: CarouselDragOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const track = ref.current;
    if (track === null) {
      return undefined;
    }
    let gesture: Gesture | null = null;
    let swallowClick = false;

    const finish = (commit: boolean) => {
      const current = gesture;
      gesture = null;
      if (!current?.isDragging) {
        return;
      }
      swallowClick = true;
      if (track.hasPointerCapture(current.pointerId)) {
        track.releasePointerCapture(current.pointerId);
      }
      delete track.dataset['dragging'];
      track.style.setProperty('--drag', '0px');
      const direction = directionOf(current.deltaX);
      if (commit && Math.abs(current.deltaX) >= STEP_PX && latest.current.canStep(direction)) {
        latest.current.onStep(direction);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      swallowClick = false;
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }
      gesture = { pointerId: event.pointerId, startX: event.clientX, deltaX: 0, isDragging: false };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (gesture?.pointerId !== event.pointerId) {
        return;
      }
      gesture.deltaX = event.clientX - gesture.startX;
      if (!gesture.isDragging && Math.abs(gesture.deltaX) < SLOP_PX) {
        return;
      }
      if (!gesture.isDragging) {
        gesture.isDragging = true;
        track.setPointerCapture(gesture.pointerId);
        track.dataset['dragging'] = 'true';
      }
      const pull = latest.current.canStep(directionOf(gesture.deltaX)) ? 1 : EDGE_RESISTANCE;
      track.style.setProperty('--drag', `${gesture.deltaX * pull}px`);
    };
    const onPointerUp = () => {
      finish(true);
    };
    const onPointerCancel = () => {
      finish(false);
    };
    const onClickCapture = (event: MouseEvent) => {
      if (swallowClick) {
        swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
      }
    };

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerUp);
    track.addEventListener('pointercancel', onPointerCancel);
    track.addEventListener('click', onClickCapture, true);
    return () => {
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', onPointerUp);
      track.removeEventListener('pointercancel', onPointerCancel);
      track.removeEventListener('click', onClickCapture, true);
    };
  }, []);

  return ref;
}
