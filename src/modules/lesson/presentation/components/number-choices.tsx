'use client';

import { Button } from '@components/ui/button';

import { cn } from '@lib/utils';

import type { SceneReaction } from '../../application/contracts/lesson-constraints';

const CHOICE_COUNT = 3;

/**
 * Three neighbouring numbers around the scene's own one, in an order that depends on it, so the
 * right one is not always in the middle. The scene already shows everything needed to find it.
 */
export function choicesAround(value: number): readonly number[] {
  const low = Math.max(0, value - 1);
  const numbers = [low, low + 1, low + 2];
  const shift = value % CHOICE_COUNT;
  return [...numbers.slice(shift), ...numbers.slice(0, shift)];
}

interface NumberChoicesProps {
  /** What the numbers answer ("Where do we land?", "How many?"). */
  readonly label: string;
  readonly value: number;
  readonly chosen: number | null;
  readonly reaction: SceneReaction | null;
  readonly attempt: number;
  readonly disabled: boolean;
  readonly onChoose: (value: number) => void;
}

/** Big number buttons to answer a counting scene by touch or keyboard; typing works in the side panel. */
export function NumberChoices({
  label,
  value,
  chosen,
  reaction,
  attempt,
  disabled,
  onChoose,
}: NumberChoicesProps) {
  return (
    <div role="group" aria-label={label} className="flex justify-center gap-3">
      {choicesAround(value).map((number) => (
        <Button
          key={`${number}-${chosen === number ? attempt : 0}`}
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={() => {
            onChoose(number);
          }}
          className={cn(
            'min-w-20 font-heading text-2xl',
            chosen === number && reaction === 'wobble' && 'animate-wobble',
            chosen === number && reaction === 'celebrate' && 'animate-pop bg-success-subtle',
          )}
        >
          {number}
        </Button>
      ))}
    </div>
  );
}
