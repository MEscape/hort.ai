'use client';

import type { CSSProperties, RefObject } from 'react';

import { useCalmMotion } from '@hooks/use-calm-motion';
import { GUIDE_WALK_MS } from '@hooks/use-guide';

import { cn } from '@lib/utils';

import { CompanionAvatar } from './companion-avatar';
import { mouthStyleOf } from './companion-visual';
import { Hearts } from './hearts';
import { LevelUpBurst } from './level-up-burst';
import { StarFlight } from './star-flight';

import type { CompanionReaction } from './companion-avatar';
import type { CompanionVisual } from './companion-visual';
import type { FeedGame } from '../hooks/use-feed-game';

function reactionOf(game: FeedGame, isCalm: boolean): CompanionReaction {
  if (game.celebration !== null) {
    return game.celebration;
  }
  if (game.reward.status === 'granted') {
    return isCalm ? 'happy' : 'none';
  }
  return game.isMouthOpen ? 'pending' : 'none';
}

interface StageCompanionProps {
  readonly game: FeedGame;
  readonly companion: CompanionVisual;
  /** Size of the companion's box. */
  readonly className: string;
  readonly avatarStyle: CSSProperties | undefined;
  readonly isSpeaking: boolean;
  /** The star of a reward flies to the level meter. */
  readonly meterRef: RefObject<HTMLDivElement | null>;
}

/**
 * The companion on its stage: the face that answers the days away and the feeding, the hearts and
 * the star of a confirmed reward, a burst for a level-up. `data-guide-home` is where a guide on the
 * page measures it, and `data-guide-character` is what it moves when it walks to a card.
 */
export function StageCompanion({
  game,
  companion,
  className,
  avatarStyle,
  isSpeaking,
  meterRef,
}: StageCompanionProps) {
  const isCalm = useCalmMotion();
  const { reward } = game;
  const isGranted = reward.status === 'granted';

  return (
    <div data-guide-home="" className={cn('relative', className)}>
      <div
        data-guide-character=""
        className="relative z-20 size-full origin-center transition-transform ease-soft"
        style={{ ...avatarStyle, transitionDuration: `${GUIDE_WALK_MS}ms` }}
      >
        <CompanionAvatar
          companion={companion}
          mood={reward.progress.mood}
          boredomLevel={reward.progress.boredomLevel}
          reaction={reactionOf(game, isCalm)}
          mouthRef={game.attachMouth}
          isMouthHinted={game.place === 'dragging'}
          isSpeaking={isSpeaking}
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
  );
}
