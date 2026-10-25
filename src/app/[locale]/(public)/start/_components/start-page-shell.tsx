import { Suspense, type ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';

interface StartPageShellProps {
  readonly children: ReactNode;
  /** Replaces the plain logo (the page passes the account header for the signed-in parent). */
  readonly header?: ReactNode;
}

/** The start page's frame with the official logo; the screen inside may stream. */
export function StartPageShell({ children, header }: StartPageShellProps) {
  const logo = <HortaiLogo className="h-10 sm:h-12" />;
  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
        {header === undefined ? (
          <header>{logo}</header>
        ) : (
          <Suspense fallback={logo}>{header}</Suspense>
        )}
        {children}
      </div>
    </main>
  );
}
