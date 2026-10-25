import type { CSSProperties } from 'react';

import { Star } from '@components/ui/icons';

const RAYS = 8;
const RADIUS_REM = 9;

/** A fixed ring of directions: the same burst every time, nothing random to test around. */
const STARS = Array.from({ length: RAYS }, (_, index) => {
  const angle = (index / RAYS) * 2 * Math.PI;
  return { id: index, x: Math.cos(angle) * RADIUS_REM, y: Math.sin(angle) * RADIUS_REM };
});

/**
 * Stars bursting from the middle of the stage after a correct answer: a celebration, not a score.
 * Decorative only; with reduced motion the global calm rules stop it.
 */
export function RewardBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map(({ id, x, y }) => (
        <Star
          key={id}
          className="absolute top-1/2 left-1/2 -mt-4 -ml-4 size-8 animate-burst fill-accent text-accent"
          style={{ '--bx': `${x}rem`, '--by': `${y}rem` } as CSSProperties}
        />
      ))}
    </div>
  );
}
