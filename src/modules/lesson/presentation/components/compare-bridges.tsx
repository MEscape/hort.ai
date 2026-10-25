'use client';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { StaticBridge, deckShare } from './bridge';

import type {
  CompareBridgesScene,
  CompareChoice,
  Fraction,
  SceneReaction,
} from '../../application/contracts/lesson-constraints';

const REACTION_CLASS: Partial<Record<SceneReaction, string>> = {
  wobble: 'animate-wobble',
  celebrate: 'animate-pop',
};

const SIDES = ['top', 'bottom'] as const;

export interface CompareBridgesProps {
  readonly scene: CompareBridgesScene;
  readonly reaction: SceneReaction | null;
  readonly chosen: CompareChoice | null;
  /** Counts the tries, so the same reaction plays again on the next one. */
  readonly attempt: number;
  /** After a correct answer the fractions are named on the bridges. */
  readonly isSolved: boolean;
  readonly disabled: boolean;
  readonly onChoose: (choice: CompareChoice) => void;
}

/** The name of a bridge's part once the child has found it: ½ written as stacked numbers. */
function FractionBadge({ fraction }: { readonly fraction: Fraction }) {
  return (
    <span
      aria-hidden
      className="absolute top-2 right-4 flex animate-pop flex-col items-center rounded-token bg-surface px-2 font-heading leading-tight text-copy shadow-soft"
    >
      <span>{fraction.numerator}</span>
      <span className="w-full border-t-2 border-copy" />
      <span>{fraction.denominator}</span>
    </span>
  );
}

/** The hint: a line where each bridge's wood ends, across both, so the lengths compare at a glance. */
function LineUp({ scene }: { readonly scene: CompareBridgesScene }) {
  return SIDES.map((side) => (
    <span
      key={side}
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-1 animate-pop border-l-4 border-dashed',
        side === 'top' ? 'border-accent' : 'border-bloom',
      )}
      // The bridge buttons have a 0.5rem padding around the frame the share is measured in.
      style={{
        left: `calc(0.5rem + (100% - 1rem) * ${deckShare(scene[side].numerator / scene[side].denominator)})`,
      }}
    />
  ));
}

/**
 * Two bridges over the same river; the child taps the one with more wood, or "both the same".
 * Each bridge is one big button with its plank count as its name, so it works by touch, keyboard
 * and screen reader alike, and the picture still says everything with motion switched off.
 */
export function CompareBridges({
  scene,
  reaction,
  chosen,
  attempt,
  isSolved,
  disabled,
  onChoose,
}: CompareBridgesProps) {
  const t = useTranslations('lesson');
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="relative flex flex-col gap-3">
        {SIDES.map((side) => (
          // @ui-plain button The whole bridge picture is the choice; a Button would restyle it as a pill.
          <button
            key={`${side}-${chosen === side ? attempt : 0}`}
            type="button"
            disabled={disabled}
            aria-label={t(side === 'top' ? 'scene.topBridge' : 'scene.bottomBridge', {
              laid: scene[side].numerator,
              parts: scene[side].denominator,
            })}
            onClick={() => {
              onChoose(side);
            }}
            className={cn(
              'relative w-full rounded-token-xl p-2 transition-transform enabled:hover:scale-[1.01] disabled:cursor-default',
              chosen === side && reaction !== null && REACTION_CLASS[reaction],
              chosen === side && isSolved && 'bg-success-subtle',
            )}
          >
            <StaticBridge parts={scene[side].denominator} laid={scene[side].numerator} />
            {isSolved ? <FractionBadge fraction={scene[side]} /> : null}
          </button>
        ))}
        {reaction === 'line-up' ? <LineUp scene={scene} /> : null}
      </div>
      <Button
        key={`same-${chosen === 'same' ? attempt : 0}`}
        variant="outline"
        size="lg"
        disabled={disabled}
        onClick={() => {
          onChoose('same');
        }}
        className={cn(
          'self-center',
          chosen === 'same' && reaction !== null && REACTION_CLASS[reaction],
        )}
      >
        {t('scene.same')}
      </Button>
    </div>
  );
}
