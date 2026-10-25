import type { ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';
import { WorldScene } from '@components/brand/world-scene';
import { PageHeader } from '@components/layout/layout-primitives';

export interface OnboardingShellProps {
  readonly children: ReactNode;
  /** Replaces the plain logo (the account header, so a parent can sign out mid-setup). */
  readonly header?: ReactNode;
}

/**
 * The world around the setup: the sky and hills behind, the logo on top, and a wide column for the
 * journey (the steps on the side, the current step in front). It is wider than a sign-in card on
 * purpose: the setup has more to say, and on a phone it simply stacks.
 */
export function OnboardingShell({ children, header }: OnboardingShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col">
      <WorldScene />
      <PageHeader
        isLandmark={header === undefined}
        className={header === undefined ? undefined : 'sm:justify-stretch'}
      >
        {header ?? <HortaiLogo />}
      </PageHeader>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-8 sm:pt-8">
        {children}
      </main>
    </div>
  );
}
