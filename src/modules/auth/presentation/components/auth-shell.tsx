import { Suspense, type ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';
import { WorldScene } from '@components/brand/world-scene';
import { PageHeader, PageMain, PageShell } from '@components/layout/layout-primitives';

import { Link } from '@i18n';

import { authRoutes } from '../routes';

export interface AuthShellProps {
  readonly children: ReactNode;
  /** Replaces the plain logo header in signed-in screens (the account header). */
  readonly header?: ReactNode;
}

/**
 * The world around every sign-in screen: the sky and hills, the logo (a way back to the front
 * door) and the screen's card in the middle. Generous room above the card is on purpose: Hort
 * sits on its edge.
 */
export function AuthShell({ children, header }: AuthShellProps) {
  return (
    <PageShell>
      <WorldScene />
      <PageHeader className={header === undefined ? undefined : 'sm:justify-stretch'}>
        <Suspense fallback={<HortaiLogo />}>
          {header ?? (
            <Link href={authRoutes.welcome()} className="rounded-token-sm">
              <HortaiLogo />
            </Link>
          )}
        </Suspense>
      </PageHeader>
      <PageMain>{children}</PageMain>
    </PageShell>
  );
}
