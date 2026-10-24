import { Suspense, type ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';
import { WorldScene } from '@components/brand/world-scene';

import { Link } from '@i18n';

import { authRoutes } from '../routes';

export interface AuthShellProps {
  readonly children: ReactNode;
}

/**
 * The world around every sign-in screen: the sky and hills, the logo (a way back to the front
 * door) and the screen's card in the middle. Generous room above the card is on purpose: Hort
 * sits on its edge.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col">
      <WorldScene />
      <header className="relative z-10 flex justify-center px-4 pt-6 sm:justify-start sm:px-10 sm:pt-8">
        <Suspense fallback={<HortaiLogo />}>
          <Link href={authRoutes.welcome()} className="rounded-token-sm">
            <HortaiLogo />
          </Link>
        </Suspense>
      </header>
      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pt-24 pb-28 sm:items-center sm:pt-20">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
