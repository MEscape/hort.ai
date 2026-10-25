'use client';

import type { CarouselDirection } from '@hooks/use-carousel-drag';

import { cn } from '@lib/utils';

export interface NeighbourTapProps {
  readonly direction: CarouselDirection;
  readonly canStep: boolean;
  readonly onStep: (direction: CarouselDirection) => void;
}

/**
 * A transparent tap area over the outer fifth of the stage (at least 56px), above the active slide.
 * The neighbour peeks out only a little from behind the big active character, so the slide itself is
 * too thin a target on a phone; this one steps to it. It is for fingers only: the previous / next
 * buttons and the arrow keys are the accessible way, so it stays out of the tab order and the
 * accessibility tree. Nothing is drawn at an end, where there is no neighbour.
 */
export function NeighbourTap({ direction, canStep, onStep }: NeighbourTapProps) {
  if (!canStep) {
    return null;
  }
  return (
    // @ui-plain button A hit area, not a visible control: the real buttons sit under the stage.
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      data-testid={direction === 1 ? 'tap-next' : 'tap-previous'}
      className={cn(
        'absolute inset-y-0 z-10 w-1/5 min-w-14 cursor-pointer',
        direction === 1 ? 'right-0' : 'left-0',
      )}
      onClick={() => {
        onStep(direction);
      }}
    />
  );
}
