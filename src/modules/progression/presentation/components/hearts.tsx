import { HeartShape } from './food/heart-shape';

const HEARTS = [
  { id: 0, drift: -48, delay: 0, size: 'size-10' },
  { id: 1, drift: 14, delay: 140, size: 'size-14' },
  { id: 2, drift: 56, delay: 280, size: 'size-9' },
  { id: 3, drift: -16, delay: 420, size: 'size-8' },
] as const;

/** A few hearts rise from where it is placed (the mouth). Mount it only after a confirmed reward. */
export function Hearts() {
  return (
    <span aria-hidden="true" data-hearts="" className="pointer-events-none absolute inset-0 z-20">
      {HEARTS.map(({ id, drift, delay, size }) => (
        <span
          key={id}
          className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 animate-heart-rise ${size}`}
          style={{ '--hx': `${drift}px`, animationDelay: `${delay}ms` } as React.CSSProperties}
        >
          <HeartShape className="size-full" />
        </span>
      ))}
    </span>
  );
}
