'use client';

import { useId, useRef } from 'react';

import { Mic, Spinner, Square } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { useVoiceInput } from '../hooks/use-voice-input';
import type { VoiceInput } from '../hooks/use-voice-input';

/** A press held at least this long ends the recording when it is let go (hold to speak). */
const HOLD_MS = 600;

/** The line under the button: what happens now, or why speaking did not help. */
function noteKey(allowed: boolean, voice: VoiceInput) {
  if (!allowed) {
    return 'input.notAllowed';
  }
  if (voice.status === 'recording') {
    return 'input.listening';
  }
  if (voice.status === 'transcribing') {
    return 'input.transcribing';
  }
  return voice.problem === null ? 'input.hint' : (`input.problem.${voice.problem}` as const);
}

export interface VoiceInputButtonProps {
  /** The speaking child: the server checks it is the parent's own and that speech is allowed. */
  readonly childProfileId: string;
  /** What the parent stored (`voiceConsent`). Without it the button is off and says why. */
  readonly allowed: boolean;
  /** Receives the transcript; put it into the field, where the child can still correct it. */
  readonly onTranscript: (text: string) => void;
  readonly className?: string;
}

/**
 * The big microphone next to a text field (#34). Tap to start and tap again to stop, or hold it
 * while speaking and let go. The transcript only lands in the field: nothing is sent until the
 * child sends the field, and the sent text is checked like typed text. Typing always stays.
 */
export function VoiceInputButton({
  childProfileId,
  allowed,
  onTranscript,
  className,
}: VoiceInputButtonProps) {
  const t = useTranslations('voice');
  const id = useId();
  const voice = useVoiceInput(childProfileId, onTranscript);
  /** When the current press began, to tell a hold (stops on release) from a tap. */
  const pressedAt = useRef(0);

  const recording = voice.status === 'recording';
  const busy = voice.status === 'transcribing';
  const note = t(noteKey(allowed, voice));

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* @ui-plain button A large round hold-to-speak control, which the Button primitive does not have. */}
      <button
        type="button"
        aria-label={recording ? t('input.stop') : t('input.start')}
        aria-pressed={recording}
        aria-describedby={`${id}-note`}
        aria-busy={busy}
        disabled={!allowed || busy}
        onPointerDown={() => {
          pressedAt.current = recording ? 0 : Date.now();
          voice.toggle();
        }}
        onPointerUp={() => {
          if (pressedAt.current > 0 && Date.now() - pressedAt.current >= HOLD_MS) {
            voice.stop();
          }
          pressedAt.current = 0;
        }}
        onClick={(event) => {
          // Pointers act on press and release above; a click without one is the keyboard.
          if (event.detail === 0) {
            voice.toggle();
          }
        }}
        className={cn(
          'flex size-16 shrink-0 items-center justify-center rounded-full shadow-lift transition-transform duration-150 ease-spring active:scale-95 disabled:opacity-50',
          recording ? 'bg-danger text-status-foreground' : 'bg-primary text-primary-foreground',
        )}
      >
        {busy && <Spinner className="size-8 animate-spin" aria-hidden="true" />}
        {!busy && recording && <Square className="size-7 fill-current" aria-hidden="true" />}
        {!busy && !recording && <Mic className="size-8" aria-hidden="true" />}
      </button>
      <p id={`${id}-note`} role="status" className="text-sm text-copy-muted">
        {note}
      </p>
    </div>
  );
}
