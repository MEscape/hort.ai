import { Star } from '@components/ui/icons';

import { cn } from '@lib/utils';

/**
 * Where each star starts and when it begins to fall, so they never move as one. They fall down the
 * two outer columns only: the middle belongs to the heading and the companion's bubble, which the
 * stars must never cross.
 */
const STARS = [
  'top-[4%] left-[5%] size-5 [animation-delay:0s]',
  'top-[4%] left-[16%] size-7 [animation-delay:0.9s]',
  'top-[4%] left-[8%] size-4 [animation-delay:0.3s]',
  'top-[4%] left-[85%] size-6 [animation-delay:1.5s]',
  'top-[4%] left-[93%] size-4 [animation-delay:0.6s]',
  'top-[4%] left-[78%] size-7 [animation-delay:1.2s]',
] as const;

/**
 * Soft stars drifting down beside the hero (the hero and the heading stand above them). With calm motion or reduced motion they hold still
 * where they start (the page's styles stop the fall), so the screen is just as festive and quiet.
 */
export function StarConfetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full">
      {STARS.map((star) => (
        <Star
          key={star}
          className={cn(
            'absolute fill-accent text-accent opacity-80 motion-safe:animate-confetti',
            star,
          )}
        />
      ))}
    </div>
  );
}
