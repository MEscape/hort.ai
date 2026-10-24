import type { ReactNode } from 'react';

import { HortaiLogo } from '@components/brand/hortai-logo';

/** The start page's frame with the official logo; the screen inside may stream. */
export function StartPageShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
        <header>
          <HortaiLogo className="h-10 sm:h-12" />
        </header>
        {children}
      </div>
    </main>
  );
}
