import { WorldScene } from '@components/brand/world-scene';
import { Star } from '@components/ui/icons';

import { cn } from '@lib/utils';

/** Where the small stars hang in the sky, under the heading and out in the gutters: the single recurring accent of the child's world. */
const STARS = [
  'top-[24%] left-[4%] size-5',
  'top-[22%] right-[5%] size-6 [animation-delay:1.2s]',
  'top-[38%] left-[2%] size-4 [animation-delay:2.4s]',
  'top-[34%] right-[3%] size-5 [animation-delay:1.8s]',
] as const;

/**
 * The world behind every step of the child's welcome: paper-coloured hills at the bottom, a soft
 * book-blue sky fading out at the top and a few quietly twinkling stars. It is only paint
 * (`aria-hidden`); the sky stays pale where the companion stands, so its picture sits on paper.
 */
export function StepBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <WorldScene />
      <div className="absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-secondary/60 to-transparent" />
      {STARS.map((position) => (
        <Star
          key={position}
          className={cn(
            'absolute fill-accent text-accent opacity-70 motion-safe:animate-twinkle',
            position,
          )}
        />
      ))}
    </div>
  );
}
