import { clamp, cn } from '@lib/utils';

const SIZE = 40;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface StatusRingProps {
  /** How much is left, 0 to 1. The ring only draws the text next to it; it never replaces it. */
  readonly fraction: number;
  /** A heads-up draws in the hint colour, never a warning red. */
  readonly isLow?: boolean;
  readonly className?: string;
}

/** A quiet ring that empties as time passes. Decorative: the minutes are always written beside it. */
export function StatusRing({ fraction, isLow = false, className }: StatusRingProps) {
  const left = clamp(fraction, 0, 1);
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden="true"
      focusable="false"
      className={cn('size-10 -rotate-90', className)}
    >
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-border"
      />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - left)}
        className={isLow ? 'stroke-hint' : 'stroke-primary'}
      />
    </svg>
  );
}
