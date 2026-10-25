'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { Button } from '@components/ui/button';
import { X } from '@components/ui/icons';

import { cn } from '@lib/utils';

interface TranscriptLineProps {
  readonly who: 'companion' | 'child';
  /** Who said it, for screen readers ("Max", "You"). */
  readonly speaker: string;
  readonly text: string;
  /** A small control under the line (the companion's "read aloud"). */
  readonly action?: ReactNode;
}

/** One line of a side panel's transcript: the companion on the left, the child on the right. */
export function TranscriptLine({ who, speaker, text, action }: TranscriptLineProps) {
  return (
    <li
      className={cn(
        'max-w-5/6 rounded-token-lg px-3 py-2 whitespace-pre-wrap text-copy',
        who === 'child'
          ? 'self-end bg-secondary text-secondary-foreground'
          : 'self-start bg-sunken',
      )}
    >
      <span className="sr-only">{speaker}: </span>
      {text}
      {action === undefined ? null : <div className="mt-2">{action}</div>}
    </li>
  );
}

export interface SidePanelFrameProps {
  readonly title: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  /** Changes when a line is added, so the transcript stays scrolled to the newest one. */
  readonly scrollKey: number;
  /** `TranscriptLine`s, oldest first. */
  readonly transcript: ReactNode;
  /** The form (and its messages) below the transcript. */
  readonly footer: ReactNode;
}

/**
 * The optional side panel of a `Stage` (R-021): everything said as text, and a way to write instead
 * of tapping or speaking. Beside the stage on wide screens, below it on phones, with a bounded
 * height there so the scene stays in view. It knows no namespace: callers pass the texts.
 */
export function SidePanelFrame({
  title,
  closeLabel,
  onClose,
  scrollKey,
  transcript,
  footer,
}: SidePanelFrameProps) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list !== null) {
      list.scrollTop = list.scrollHeight;
    }
  }, [scrollKey]);

  return (
    <aside
      aria-label={title}
      className="flex max-h-72 w-full shrink-0 flex-col gap-3 rounded-token-xl bg-surface p-4 shadow-lift sm:max-h-80 lg:max-h-none lg:w-96"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel}>
          <X aria-hidden />
        </Button>
      </div>
      <ol ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {transcript}
      </ol>
      {footer}
    </aside>
  );
}
