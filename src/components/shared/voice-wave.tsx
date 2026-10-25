import { cn } from '@lib/utils';

/** Bar heights from the shortest to the tallest: a small wave, the same on both sides of the button. */
const BARS = ['h-4', 'h-7', 'h-11', 'h-6'] as const;
const DELAYS = [
  '[animation-delay:0ms]',
  '[animation-delay:120ms]',
  '[animation-delay:240ms]',
  '[animation-delay:360ms]',
] as const;

export interface VoiceWaveProps {
  /** True while the sound plays: the bars move. */
  readonly isMoving: boolean;
  /** Mirrors the wave for the right-hand side of the button. */
  readonly isMirrored?: boolean;
}

/** Decorative sound bars beside the play button; they move while the voice plays. */
export function VoiceWave({ isMoving, isMirrored = false }: VoiceWaveProps) {
  const bars = isMirrored ? [...BARS].reverse() : BARS;
  return (
    <span aria-hidden="true" className="flex h-12 items-center gap-1.5">
      {bars.map((height, index) => (
        <span
          key={height}
          className={cn(
            'w-2 origin-center rounded-full bg-primary-copy',
            height,
            isMoving ? cn('animate-bars', DELAYS[index]) : 'opacity-40',
          )}
        />
      ))}
    </span>
  );
}
