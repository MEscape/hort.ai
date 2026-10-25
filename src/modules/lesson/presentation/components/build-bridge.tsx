'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { BridgeFrame, Plank } from './bridge';

import type {
  BuildBridgeScene,
  SceneReaction,
} from '../../application/contracts/lesson-constraints';

export interface BuildBridgeProps {
  readonly scene: BuildBridgeScene;
  readonly reaction: SceneReaction | null;
  /** Counts the tries, so the wobble plays again on the next one. */
  readonly attempt: number;
  readonly disabled: boolean;
  readonly onSubmit: (laid: number) => void;
}

/** Numbers each laid plank from the left bank, for the companion counting along. */
function plankNumbers(laid: readonly boolean[]): ReadonlyArray<number | undefined> {
  let count = 0;
  return laid.map((isLaid) => (isLaid ? (count += 1) : undefined));
}

/**
 * The child builds the asked part of a bridge: every slot is a toggle (tap or Space/Enter), and
 * "bridge finished" sends the count to the backend. Nothing is judged here. The hint numbers the
 * laid planks; a miss wobbles the bridge, and the planks stay where the child put them.
 */
export function BuildBridge({ scene, reaction, attempt, disabled, onSubmit }: BuildBridgeProps) {
  const t = useTranslations('lesson');
  const [laid, setLaid] = useState<readonly boolean[]>(() =>
    Array.from({ length: scene.target.denominator }, () => false),
  );
  const numbers = plankNumbers(laid);
  const toggle = (index: number) => {
    setLaid(laid.map((isLaid, at) => (at === index ? !isLaid : isLaid)));
  };

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-5">
      <div
        key={reaction === 'wobble' ? attempt : 0}
        role="group"
        aria-label={t('scene.bridge', { parts: scene.target.denominator })}
        className={cn('w-full', reaction === 'wobble' && 'animate-wobble')}
      >
        <BridgeFrame>
          {laid.map((isLaid, index) => (
            // @ui-plain button Each plank slot is a toggle drawn as wood; a Button would hide the bridge.
            <button
              // eslint-disable-next-line react/no-array-index-key -- a slot is its position; slots never move
              key={index}
              type="button"
              aria-pressed={isLaid}
              aria-label={t('scene.plank', { number: index + 1 })}
              disabled={disabled}
              onClick={() => {
                toggle(index);
              }}
              className="flex h-full flex-1 rounded-token-sm"
            >
              <Plank
                laid={isLaid}
                number={reaction === 'count-planks' ? numbers[index] : undefined}
              />
            </button>
          ))}
        </BridgeFrame>
      </div>
      <p className="sr-only" aria-live="polite">
        {t('scene.laidCount', {
          laid: laid.filter(Boolean).length,
          parts: scene.target.denominator,
        })}
      </p>
      <Button
        size="lg"
        disabled={disabled}
        onClick={() => {
          onSubmit(laid.filter(Boolean).length);
        }}
      >
        {t('scene.buildDone')}
      </Button>
    </div>
  );
}
