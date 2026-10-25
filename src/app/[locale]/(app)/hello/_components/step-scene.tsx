import type { ReactNode } from 'react';

import { FormAlert } from '@components/shared/form-alert';

import { cn } from '@lib/utils';

export interface StepSceneProps {
  /** The heading of the step: at most three words. The step's one `h1`. */
  readonly title?: string;
  /** The big button of the step, pinned to the bottom of the screen. */
  readonly footer?: ReactNode;
  /** Why the last save failed, said right above the button; `undefined` when fine. */
  readonly error?: string | undefined;
  /** A soft fade under the button, for a step whose content scrolls beneath it. */
  readonly hasFade?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * The layout every step shares: a big heading, the content in the middle (centred, the hero of the
 * step) and the one big button pinned to the bottom (with `hasFade`, over a soft fade so content
 * scrolling under it stays readable). The back button and the dots live in the shell, so they do not move with a step.
 */
export function StepScene({
  title,
  footer,
  error,
  hasFade = false,
  className,
  children,
}: StepSceneProps) {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center">
      {title !== undefined && (
        <h1
          tabIndex={-1}
          className="relative pt-2 text-4xl text-copy wrap-anywhere focus-visible:outline-none sm:text-5xl"
        >
          {title}
        </h1>
      )}
      <div
        className={cn(
          'relative flex w-full flex-1 flex-col items-center justify-center gap-4',
          className,
        )}
      >
        {children}
      </div>
      {footer !== undefined && (
        <div
          className={cn(
            'sticky bottom-0 z-20 flex w-full flex-col items-center gap-3 pt-6 pb-safe',
            hasFade &&
              "before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:bg-linear-to-t before:from-canvas/95 before:via-canvas/70 before:to-transparent before:content-['']",
          )}
        >
          <FormAlert id="welcome-error" message={error} />
          {footer}
        </div>
      )}
    </div>
  );
}
