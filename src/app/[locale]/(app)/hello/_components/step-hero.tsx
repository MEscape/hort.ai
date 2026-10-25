import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

import { SpeechBubble } from './speech-bubble';

const SIZE = {
  /** The companion is the screen: at least 40% of a phone's height. */
  large: 'size-[min(40dvh,86vw,24rem)]',
  /** A companion beside other things to do (the interest tiles). */
  small: 'size-24 sm:size-32',
} as const;

export interface StepHeroProps {
  readonly size?: keyof typeof SIZE;
  /** The companion's line, or nothing when it is quiet. */
  readonly bubble?: string;
  /** True when the bubble changes in answer to the child. */
  readonly isBubbleLive?: boolean;
  /** The companion (a `CompanionAvatar`, sized to fill this box with `size-full`). */
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * The hero of a step: the companion with its line in a bubble above. The pictures are transparent,
 * so the companion stands on the scene itself, with nothing painted under it.
 */
export function StepHero({
  size = 'large',
  bubble,
  isBubbleLive = false,
  children,
  className,
}: StepHeroProps) {
  return (
    <div className={cn('relative flex min-w-0 flex-col items-center gap-3', className)}>
      {bubble !== undefined && <SpeechBubble text={bubble} isLive={isBubbleLive} />}
      <div className={cn('relative', SIZE[size])}>{children}</div>
    </div>
  );
}
