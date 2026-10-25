'use client';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { NumberChoices } from './number-choices';

import type { GroupsScene, SceneReaction } from '../../application/contracts/lesson-constraints';

export interface GroupsProps {
  readonly scene: GroupsScene;
  readonly reaction: SceneReaction | null;
  readonly chosen: number | null;
  readonly attempt: number;
  readonly isSolved: boolean;
  readonly disabled: boolean;
  readonly onChoose: (value: number) => void;
}

/** A dot, numbered while the companion counts along. */
function Dot({ number }: { readonly number?: number | undefined }) {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
      {number}
    </span>
  );
}

/** One plate: a round tray holding its dots, or empty while the dots still lie in the pile. */
function Plate({
  index,
  count,
  firstNumber,
}: {
  readonly index: number;
  readonly count: number;
  /** Numbers the dots from here on; `undefined` draws them plain. */
  readonly firstNumber: number | undefined;
}) {
  const t = useTranslations('lesson');
  return (
    <li
      aria-label={
        count === 0
          ? t('sceneLabels.emptyPlate', { number: index + 1 })
          : t('sceneLabels.plate', { number: index + 1, count })
      }
      className="flex min-h-20 w-24 flex-wrap content-center items-center justify-center gap-1 rounded-full border-4 border-island-wood/60 bg-surface p-3 shadow-soft"
    >
      {Array.from({ length: count }, (_, dot) => (
        <Dot key={dot} number={firstNumber === undefined ? undefined : firstNumber + dot} />
      ))}
    </li>
  );
}

/**
 * Plates with dots. For "times" every plate shows its dots and the child says how many in all (the
 * hint numbers them). For "divided by" the dots lie in a pile above empty plates and the child says
 * how many each plate gets (the hint deals them out). A correct answer shows the plates filled.
 */
export function Groups({
  scene,
  reaction,
  chosen,
  attempt,
  isSolved,
  disabled,
  onChoose,
}: GroupsProps) {
  const t = useTranslations('lesson');
  const total = scene.groups * scene.each;
  const isDealt = scene.ask === 'total' || isSolved || reaction === 'deal-out';
  const isCounted = scene.ask === 'total' && reaction === 'count-steps';

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5">
      {isDealt ? null : (
        <p
          aria-label={t('sceneLabels.pile', { total })}
          className="flex max-w-xs flex-wrap justify-center gap-1 rounded-token-lg bg-surface/70 p-3"
        >
          {Array.from({ length: total }, (_, dot) => (
            <Dot key={dot} />
          ))}
        </p>
      )}
      <ul
        className={cn(
          'flex flex-wrap justify-center gap-3',
          reaction === 'deal-out' && 'animate-pop',
        )}
      >
        {Array.from({ length: scene.groups }, (_, index) => (
          <Plate
            key={index}
            index={index}
            count={isDealt ? scene.each : 0}
            firstNumber={isCounted ? index * scene.each + 1 : undefined}
          />
        ))}
      </ul>
      <NumberChoices
        label={t('sceneLabels.choices')}
        value={scene.ask === 'total' ? total : scene.each}
        chosen={chosen}
        reaction={reaction}
        attempt={attempt}
        disabled={disabled}
        onChoose={onChoose}
      />
    </div>
  );
}
