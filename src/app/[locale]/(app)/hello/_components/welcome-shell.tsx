'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { BackButton } from './back-button';
import { StepBackdrop } from './step-backdrop';
import { WelcomeProgress } from './welcome-progress';

/** Back button, dots, and an empty cell of the back button's width so the dots stay centred. */
const HEADER = 'grid grid-cols-[3rem_1fr_3rem] items-center gap-2 pt-5 pb-3';

const ARRIVAL = {
  first: '',
  forward:
    'motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-right-6',
  back: 'motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-left-6',
} as const;

export interface WelcomeShellProps {
  readonly index: number;
  readonly direction: keyof typeof ARRIVAL;
  /** True while a choice is being stored: going back then waits. */
  readonly isBusy: boolean;
  readonly onBack: () => void;
  readonly children: ReactNode;
}

/**
 * The world around every step: the scene behind, the round back button and the dots on top, and the
 * current step arriving with a short slide and fade (transform and opacity only; calm mode and
 * reduced motion switch it off). The first screen does not arrive: it is there at once, so the
 * handover from the parent's setup shows no half-faded companion. When the step changes, focus moves to its heading so a keyboard or
 * screen-reader child lands on the new screen.
 */
export function WelcomeShell({ index, direction, isBusy, onBack, children }: WelcomeShellProps) {
  const stepRef = useRef<HTMLDivElement>(null);
  const shownIndex = useRef(index);

  useEffect(() => {
    if (shownIndex.current === index) {
      return;
    }
    shownIndex.current = index;
    const heading = stepRef.current?.querySelector<HTMLElement>('h1, h2');
    if (heading !== null && heading !== undefined) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }, [index]);

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <StepBackdrop />
      {/* No z-index here: a stacking context would cut the companion's picture off from the paper it is blended into. */}
      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col px-4">
        <header className={HEADER}>
          <div>{index > 0 && <BackButton disabled={isBusy} onClick={onBack} />}</div>
          <WelcomeProgress index={index} />
        </header>
        <main key={index} ref={stepRef} className={`flex flex-1 flex-col ${ARRIVAL[direction]}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
