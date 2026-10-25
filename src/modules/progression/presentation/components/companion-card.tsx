'use client';

import { useId } from 'react';
import type { CSSProperties } from 'react';

import { useFeedGame } from '../hooks/use-feed-game';

import { FeedStage } from './feed-stage';

import type { CompanionVisual } from './companion-visual';
import type { ProgressDto } from '../dto/progress-dto';

export interface CompanionCardProps {
  readonly progress: ProgressDto;
  readonly companion: CompanionVisual;
  /** Size of the companion's box; defaults to the home screen's. */
  readonly avatarClassName?: string;
  /** See `FeedStageProps.guided`. */
  readonly guided?: 'speaking' | 'away' | undefined;
  readonly avatarStyle?: CSSProperties | undefined;
  readonly isSpeaking?: boolean;
  readonly variant?: 'welcome' | 'home';
}

/**
 * The companion on the home screen: its face shows how long the child was away, the level meter is
 * the real one, and the same feeding game as in the welcome gives today's star. Fed today, it is
 * content and says "see you tomorrow"; otherwise it waits for its treat. Nothing is lost on a day
 * the child did not come.
 */
export function CompanionCard({
  progress,
  companion,
  avatarClassName = 'size-[min(32dvh,70vw,17rem)]',
  guided,
  avatarStyle,
  isSpeaking = false,
  variant = 'welcome',
}: CompanionCardProps) {
  const titleId = useId();
  const game = useFeedGame(progress);

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">
        {companion.name}
      </h2>
      <FeedStage
        game={game}
        companion={companion}
        avatarClassName={avatarClassName}
        guided={guided}
        avatarStyle={avatarStyle}
        isSpeaking={isSpeaking}
        variant={variant}
      />
    </section>
  );
}
