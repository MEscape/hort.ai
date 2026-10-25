'use client';

import type { ReactNode } from 'react';

import { Character, type MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face';
import { VoicePlayButton } from '@components/shared/voice-play-button';
import { VoiceWave } from '@components/shared/voice-wave';
import { CircleAlert } from '@components/ui/icons';

import { useCalmMotion } from '@hooks/use-calm-motion';
import { useCharacterExpression } from '@hooks/use-character-expression';
import { useVoicePreview, type VoicePreviewPhase } from '@hooks/use-voice-preview';

import { cn } from '@lib/utils';

export interface VoicePreviewLabels {
  /** The button at rest, e.g. "Hear Max". */
  readonly play: string;
  readonly stop: string;
  /** The button after a failure, e.g. "Try again". */
  readonly retry: string;
  /** Status while the sound starts, e.g. "Getting ready…". */
  readonly loading: string;
  /** Said (not shown) while it plays, e.g. "Max is speaking…". */
  readonly speaking: string;
  /** Status when there is no sound file at all. */
  readonly unavailable: string;
  /** Status when the sound failed. */
  readonly failed: string;
  /** Names the progress ring for a screen reader. */
  readonly progress: string;
}

export interface VoicePreviewProps {
  /** The stored spoken introduction; an empty address is "unavailable". */
  readonly url: string;
  readonly imageUrl: string;
  readonly imageOpenUrl?: string | undefined;
  readonly openAlignment?: MouthAlignment | undefined;
  /** Where its eyes are: it blinks, and smiles with closed eyes while it speaks. */
  readonly face?: CharacterFace | undefined;
  readonly labels: VoicePreviewLabels;
  /** The character's line above it, e.g. a speech bubble. */
  readonly bubble?: ReactNode;
  readonly className?: string;
}

/** The button's name and the status words for a phase; only waiting and trouble are shown. */
function copyOf(phase: VoicePreviewPhase, labels: VoicePreviewLabels) {
  const copy: Record<VoicePreviewPhase, { button: string; status: string }> = {
    ready: { button: labels.play, status: '' },
    loading: { button: labels.stop, status: labels.loading },
    listening: { button: labels.stop, status: labels.speaking },
    unavailable: { button: labels.play, status: labels.unavailable },
    failed: { button: labels.retry, status: labels.failed },
  };
  return copy[phase];
}

/**
 * A character you can listen to: a big picture (tap it to hear), one huge round play button with
 * sound bars on both sides and a ring that fills as it plays. While it speaks the mouth moves (and a
 * soft ring pulses unless calm mode is on); while the sound starts there is a spinner; with no
 * sound file or after a failure a short text says so and the button offers a retry. The status text
 * hangs below the component out of the flow, so no phase ever changes the height of the page (it
 * once did, which made the page scrollbar flicker while the sound started). Nothing plays
 * until a press, only one sound ever plays, and it stops when the address changes or the screen is
 * left. Tapping the picture is a convenience for fingers; the button is the control a keyboard and a
 * screen reader use. The speaking text is read, not shown: nothing depends on sound or motion.
 */
export function VoicePreview({
  url,
  imageUrl,
  imageOpenUrl,
  openAlignment,
  face,
  labels,
  bubble,
  className,
}: VoicePreviewProps) {
  const { phase, progress, toggle } = useVoicePreview(url);
  const isCalm = useCalmMotion();
  const { expression, ref } = useCharacterExpression({
    reaction: phase === 'listening' ? 'happy' : 'none',
  });
  const copy = copyOf(phase, labels);
  const isListening = phase === 'listening';
  const isTrouble = phase === 'failed' || phase === 'unavailable';

  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center gap-3 [--hero:min(38dvh,78vw,22rem)]',
        className,
      )}
    >
      {bubble}
      <div ref={ref} className="relative size-(--hero)">
        {isListening && !isCalm && (
          <span
            aria-hidden="true"
            className="absolute inset-2 animate-ripple rounded-full border-4 border-accent"
          />
        )}
        {/* @ui-plain button A tap on the picture plays it as well; the labelled play button is the control for keyboard and screen reader. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={toggle}
          className="relative block size-full cursor-pointer rounded-full"
        >
          <Character
            imageUrl={imageUrl}
            openImageUrl={imageOpenUrl}
            openAlignment={openAlignment}
            face={face}
            expression={expression}
            isSpeaking={isListening}
            alt=""
            fetchPriority="high"
            className="size-full"
          />
        </button>
      </div>
      <div className="relative z-10 -mt-2 flex items-center gap-4">
        <VoiceWave isMoving={isListening} />
        <VoicePlayButton
          phase={phase}
          progress={progress}
          label={copy.button}
          progressLabel={labels.progress}
          onClick={toggle}
        />
        <VoiceWave isMoving={isListening} isMirrored />
      </div>
      <p
        role="status"
        className={
          isTrouble || phase === 'loading'
            ? 'absolute inset-x-0 top-full flex items-center justify-center gap-2 text-lg font-semibold text-copy-muted'
            : 'sr-only'
        }
      >
        {isTrouble && <CircleAlert className="size-5" aria-hidden="true" />}
        {copy.status}
      </p>
    </div>
  );
}
