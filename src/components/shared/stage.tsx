'use client';

import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

interface StepDotsProps {
  readonly current: number;
  readonly total: number;
  readonly label: string;
}

/** Where the child is: orientation only, no timer and no score. */
function StepDots({ current, total, label }: StepDotsProps) {
  return (
    <p className="flex items-center gap-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={cn(
            'size-3 rounded-full transition-colors',
            index < current - 1 && 'bg-success',
            index === current - 1 && 'size-4 bg-accent',
            index >= current && 'bg-border-strong/40',
          )}
        />
      ))}
    </p>
  );
}

export interface StageProps {
  readonly title: string;
  readonly current: number;
  readonly total: number;
  /** The orientation in words ("Step 2 of 5"), for screen readers. */
  readonly progressLabel: string;
  /** The companion, standing at the bottom left. */
  readonly companion: ReactNode;
  /** The one sentence on screen: narration, feedback or the conclusion. */
  readonly line: string;
  /** What the child can do besides acting on the scene (next, once more). */
  readonly action?: ReactNode;
  /** The reward layer, drawn over everything. */
  readonly reward?: ReactNode;
  /** Small controls next to the orientation (the side panel's toggle). */
  readonly tools?: ReactNode;
  /** The optional side panel, beside the stage on wide screens and below it on phones. */
  readonly side?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The one shell every canvas screen of a child is drawn in (lessons now, homework help next): the
 * world's sky, orientation, the scene in the middle, the companion with the single sentence at the
 * bottom, and the reward layer on top; the side panel, when open, stands beside it. What renders
 * inside never sets its own background, fonts or timing. It knows no namespace: callers pass text.
 */
export function Stage({
  title,
  current,
  total,
  progressLabel,
  companion,
  line,
  action,
  reward,
  tools,
  side,
  children,
}: StageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <section
        aria-label={title}
        data-world="lagoon"
        className="relative isolate flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-token-xl bg-world p-4 shadow-soft sm:p-6"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-xl font-semibold sm:text-2xl">{title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <StepDots current={current} total={total} label={progressLabel} />
            {tools}
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center py-2">{children}</div>
        {/* Pinned, so the companion and the next action stay in reach when a phone scrolls the scene. */}
        <footer className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-end gap-3 bg-canvas/95 px-4 pt-3 pb-4 sm:-mx-6 sm:-mb-6 sm:gap-5 sm:px-6 sm:pb-6">
          {companion}
          <div className="mb-2 flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end [&>a]:h-auto [&>a]:min-h-14 [&>a]:whitespace-normal [&>button]:h-auto [&>button]:min-h-14 [&>button]:whitespace-normal">
            <p
              aria-live="polite"
              className="flex-1 rounded-token-xl bg-surface p-4 text-lead text-copy shadow-soft"
            >
              {line}
            </p>
            {action}
          </div>
        </footer>
        {reward}
      </section>
      {side}
    </div>
  );
}
