import type { ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';
import { WorldScene } from '@components/brand/world-scene';

export interface OnboardingShellProps {
  readonly children: ReactNode;
}

/**
 * The world around the setup: the sky and hills behind, the logo on top, and a wide column for the
 * journey (the steps on the side, the current step in front). It is wider than a sign-in card on
 * purpose: the setup has more to say, and on a phone it simply stacks.
 */
export function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col">
      <WorldScene />
      <header className="relative z-10 flex justify-center px-4 pt-6 sm:justify-start sm:px-10 sm:pt-8">
        <HortaiLogo />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-8 sm:pt-8">
        {children}
      </main>
    </div>
  );
}
