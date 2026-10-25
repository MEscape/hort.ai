import { SparkleShape } from './food/sparkle-shape';

const RAYS = 8;
const RADIUS_PX = 130;

const SPARKLES = Array.from({ length: RAYS }, (_, index) => {
  const angle = (index / RAYS) * 2 * Math.PI;
  return {
    id: index,
    x: Math.round(Math.cos(angle) * RADIUS_PX),
    y: Math.round(Math.sin(angle) * RADIUS_PX),
  };
});

/** Sparkles fly out from the middle of the box they stand in. Mount it only for a confirmed level-up. */
export function LevelUpBurst() {
  return (
    <span aria-hidden="true" data-level-up="" className="pointer-events-none absolute inset-0 z-20">
      {SPARKLES.map(({ id, x, y }) => (
        <span
          key={id}
          className="absolute top-1/2 left-1/2 -mt-4 -ml-4 size-8 animate-burst"
          style={{ '--bx': `${x}px`, '--by': `${y}px` } as React.CSSProperties}
        >
          <SparkleShape className="size-full" />
        </span>
      ))}
    </span>
  );
}
