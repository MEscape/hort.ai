'use client';

import { Play, RotateCcw, Spinner, Square } from '@components/ui/icons';

import type { VoicePreviewPhase } from '@hooks/use-voice-preview';

import { cn } from '@lib/utils';

const PERCENT = 100;
const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function PhaseIcon({ phase }: { readonly phase: VoicePreviewPhase }) {
  if (phase === 'loading') {
    return <Spinner className="size-10 animate-spin" aria-hidden="true" />;
  }
  if (phase === 'listening') {
    return <Square className="size-8 fill-current" aria-hidden="true" />;
  }
  return phase === 'failed' ? (
    <RotateCcw className="size-10" aria-hidden="true" />
  ) : (
    <Play className="ml-1 size-10 fill-current" aria-hidden="true" />
  );
}

export interface VoicePlayButtonProps {
  readonly phase: VoicePreviewPhase;
  /** How far the sound is, 0 to 1: the ring around the button fills with it. */
  readonly progress: number;
  /** What the button does now, for a screen reader ("Hear Max", "Stop", "Try again"). */
  readonly label: string;
  readonly progressLabel: string;
  readonly onClick: () => void;
}

/**
 * The one huge round button of the voice step: play at rest, stop while it speaks, a spinner while
 * the sound starts and an arrow to try again after a failure. A ring around it fills as the sound
 * plays. With no sound file at all it is disabled and faded; the text under it says why.
 */
export function VoicePlayButton({
  phase,
  progress,
  label,
  progressLabel,
  onClick,
}: VoicePlayButtonProps) {
  return (
    // @ui-plain button A round icon-only control with a progress ring, which the Button primitive does not have.
    <button
      type="button"
      aria-label={label}
      disabled={phase === 'unavailable'}
      onClick={onClick}
      className="relative flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform duration-150 ease-spring active:scale-95 disabled:opacity-50"
    >
      <svg
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={0}
        aria-valuemax={PERCENT}
        aria-valuenow={Math.round(progress * PERCENT)}
        viewBox="0 0 100 100"
        className={cn(
          'absolute inset-0 size-full -rotate-90 transition-opacity duration-300',
          phase === 'listening' ? 'opacity-100' : 'opacity-0',
        )}
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          className="stroke-primary-foreground/25"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="stroke-accent"
        />
      </svg>
      <PhaseIcon phase={phase} />
    </button>
  );
}
