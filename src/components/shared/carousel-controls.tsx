'use client';

import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { ArrowLeft, ArrowRight } from '@components/ui/icons';

export interface CarouselControlsProps {
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly canStepBack: boolean;
  readonly canStepForward: boolean;
  readonly onStep: (direction: -1 | 1) => void;
  /** What stands between the two buttons: the active character's name. */
  readonly children: ReactNode;
}

const ARROW =
  'size-14 rounded-full border-border-strong shadow-soft aria-disabled:pointer-events-none aria-disabled:opacity-40';

/**
 * The two big round buttons with the active name between them. At an end a button stays focusable
 * (`aria-disabled`) so focus is not lost when the last step is taken with it. There are no
 * position dots: the neighbours standing at the sides and the dimmed button at an end say it.
 */
export function CarouselControls({
  previousLabel,
  nextLabel,
  canStepBack,
  canStepForward,
  onStep,
  children,
}: CarouselControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={previousLabel}
        aria-disabled={!canStepBack}
        className={ARROW}
        onClick={() => {
          onStep(-1);
        }}
      >
        <ArrowLeft className="size-7" aria-hidden="true" />
      </Button>
      {children}
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={nextLabel}
        aria-disabled={!canStepForward}
        className={ARROW}
        onClick={() => {
          onStep(1);
        }}
      >
        <ArrowRight className="size-7" aria-hidden="true" />
      </Button>
    </div>
  );
}
