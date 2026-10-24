import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

type FeedbackTone = 'success' | 'nudge' | 'hint';

const TONE_CLASSES: Record<FeedbackTone, string> = {
  success: 'bg-success-subtle border-success-border text-success',
  nudge: 'bg-nudge-subtle border-nudge-border text-nudge',
  hint: 'bg-hint-subtle border-hint-border text-hint',
};

const TONE_SYMBOLS: Record<FeedbackTone, string> = {
  success: '✓',
  nudge: '↻',
  hint: '?',
};

interface FeedbackPanelProps {
  readonly tone: FeedbackTone;
  readonly announce?: boolean;
  readonly title: string;
  readonly children: ReactNode;
}

/** Child-facing encouragement: an incorrect attempt is never represented as system danger. */
export function FeedbackPanel({ tone, title, children, announce = false }: FeedbackPanelProps) {
  return (
    <div
      role={announce ? 'status' : undefined}
      className={cn('rounded-token-lg border-2 p-4', TONE_CLASSES[tone])}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current font-heading text-lg"
        >
          {TONE_SYMBOLS[tone]}
        </span>
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold">{title}</p>
          <div className="text-base leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
