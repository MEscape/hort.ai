'use client';

import { useEffect, useRef } from 'react';

import { WorldScene } from '@components/brand/world-scene';
import { Button } from '@components/ui/button';
import { Sun } from '@components/ui/icons';

import { useCalmMotion } from '@hooks/use-calm-motion';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { CompanionAvatar } from './companion-avatar';
import { CompanionBubble } from './companion-bubble';
import { mouthStyleOf, type CompanionVisual } from './companion-visual';
import { Food } from './food/food';
import { Hearts } from './hearts';
import { LevelMeter } from './level-meter';
import { LevelUpBurst } from './level-up-burst';
import { StarFlight } from './star-flight';

import type { CompanionReaction } from './companion-avatar';
import type { FeedGame } from '../hooks/use-feed-game';

export interface FeedStageProps {
  readonly game: FeedGame;
  readonly companion: CompanionVisual;
  /** Size of the companion's box; the stage grows around it. */
  readonly avatarClassName: string;
}

type GameProps = Pick<FeedStageProps, 'game' | 'companion'>;

type Says =
  'hungry' | 'snack' | 'sleepy' | 'bored' | 'pending' | 'granted' | 'levelUp' | 'full' | 'error';

/** The companion's line while the food is still on the tray: more bored the longer the child was away. */
const SAYS_BY_BOREDOM = ['hungry', 'snack', 'sleepy', 'bored', 'bored'] as const;

function saysOf({ reward, place }: FeedGame): Says {
  switch (reward.status) {
    case 'granted':
      return reward.leveledUp ? 'levelUp' : 'granted';
    case 'already':
      return 'full';
    case 'error':
      return 'error';
    case 'pending':
      return 'pending';
    case 'available':
      return place === 'mouth' ? 'pending' : SAYS_BY_BOREDOM[reward.progress.boredomLevel];
  }
}

function reactionOf(game: FeedGame, isCalm: boolean): CompanionReaction {
  if (game.celebration !== null) {
    return game.celebration;
  }
  if (game.reward.status === 'granted') {
    return isCalm ? 'happy' : 'none';
  }
  return game.isMouthOpen ? 'pending' : 'none';
}

const EATEN_SCALE = 0.2;
const LIFTED_SCALE = 1.15;

function scaleOf(place: FeedGame['place'], isEaten: boolean): number {
  if (isEaten) {
    return EATEN_SCALE;
  }
  return place === 'dragging' ? LIFTED_SCALE : 1;
}

/** The treat on its plate. Pick it up and drag it to the mouth, or just tap it (or press Enter). */
function FoodButton({ game, companion }: GameProps) {
  const t = useTranslations('progression');
  const { place, offset, canFeed, reward, attachFood, foodHandlers } = game;
  const isEaten = reward.status === 'granted';
  const scale = scaleOf(place, isEaten);

  return (
    <Button
      ref={attachFood}
      type="button"
      variant="ghost"
      aria-label={
        reward.status === 'error' ? t('feed.retry') : t('feed.foodLabel', { name: companion.name })
      }
      aria-disabled={!canFeed}
      aria-hidden={isEaten || undefined}
      tabIndex={isEaten ? -1 : undefined}
      data-place={place}
      className={cn(
        'relative z-10 size-20 touch-none rounded-full p-0 outline-offset-4 select-none hover:bg-transparent',
        place === 'dragging'
          ? 'cursor-grabbing duration-0'
          : 'transition-[transform,opacity] duration-300 ease-spring',
        canFeed && place === 'tray' && 'cursor-grab',
        isEaten && 'pointer-events-none opacity-0',
      )}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
      {...foodHandlers}
    >
      <Food
        companionId={companion.id}
        className={cn('size-18 drop-shadow-md', canFeed && place === 'tray' && 'animate-food-bob')}
      />
    </Button>
  );
}

/** The line under the plate: how to feed, or (when it failed) what to do about it. */
function TrayNote({ game }: Pick<FeedStageProps, 'game'>) {
  const t = useTranslations('progression');
  const hasFailed = game.reward.status === 'error';
  const text = hasFailed ? game.reward.errorText : t('feed.hint');
  return (
    <p
      role={hasFailed ? 'alert' : undefined}
      className={cn(
        'min-h-5 text-center text-sm font-semibold',
        hasFailed ? 'text-nudge' : 'text-copy',
      )}
    >
      {hasFailed || game.canFeed ? text : ''}
    </p>
  );
}

/** What stands under the companion: the food, or (after today's) a quiet "see you tomorrow". */
function Tray({ game, companion }: GameProps) {
  const t = useTranslations('progression');

  return (
    <div className="relative -mt-5 flex w-72 max-w-full flex-col items-center">
      <div className="relative flex h-22 w-full items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-1 h-14 border-2 border-highlight-border bg-highlight shadow-soft"
          style={{ borderRadius: '50%' }}
        />
        {game.reward.status === 'already' || game.reward.status === 'granted' ? (
          <p className="relative flex items-center gap-2 rounded-full bg-surface px-4 py-2 font-heading text-lg font-semibold shadow-soft">
            <Sun aria-hidden="true" className="size-6 text-accent-copy" />
            {t('feed.tomorrow')}
          </p>
        ) : (
          <FoodButton game={game} companion={companion} />
        )}
      </div>
      <TrayNote game={game} />
    </div>
  );
}

/**
 * The feeding game: the companion (hungry, sleepy or bored by the days away), a speech bubble with one
 * short line, and its treat on a plate. A tap, Enter or a drop on the mouth all call the same claim;
 * the answer of the server alone moves the stage on (chewing, hearts, a star into the meter, a burst
 * for a level-up). A failed claim sends the food back with a short message and a retry. After
 * today's reward a quiet "tomorrow" sits where the food was: nothing is lost on any other day.
 */
export function FeedStage({ game, companion, avatarClassName }: FeedStageProps) {
  const t = useTranslations('progression');
  const isCalm = useCalmMotion();
  const bubbleRef = useRef<HTMLParagraphElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const { reward } = game;
  const isGranted = reward.status === 'granted';

  // The food button is gone after the reward: focus moves to the line the companion says.
  useEffect(() => {
    if (isGranted) {
      bubbleRef.current?.focus();
    }
  }, [isGranted]);

  return (
    <div className="relative isolate flex flex-col items-center gap-2 overflow-hidden rounded-token-xl border-2 border-border bg-canvas px-3 pt-3 pb-2 shadow-soft">
      <WorldScene />
      <div ref={meterRef} className="relative w-full">
        <LevelMeter progress={reward.progress} />
      </div>
      <CompanionBubble
        focusRef={bubbleRef}
        srOnly={isGranted ? t('feed.gainedSr', { xp: reward.progress.dailyReward.xp }) : undefined}
      >
        {t(`feed.says.${saysOf(game)}`, { level: reward.progress.level })}
      </CompanionBubble>
      <div className={cn('relative', avatarClassName)}>
        <div className="size-full">
          <CompanionAvatar
            companion={companion}
            mood={reward.progress.mood}
            boredomLevel={reward.progress.boredomLevel}
            reaction={reactionOf(game, isCalm)}
            mouthRef={game.attachMouth}
            isMouthHinted={game.place === 'dragging'}
            className="size-full"
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute size-0"
          style={mouthStyleOf(companion)}
        >
          {isGranted && !isCalm && <Hearts />}
          {isGranted && (
            <span className="absolute -top-5 -left-5 size-10">
              <StarFlight targetRef={meterRef} />
            </span>
          )}
        </span>
        {isGranted && reward.leveledUp && !isCalm && <LevelUpBurst />}
      </div>
      <Tray game={game} companion={companion} />
    </div>
  );
}
