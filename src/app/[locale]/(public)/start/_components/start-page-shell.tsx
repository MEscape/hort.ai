import { Suspense, type ReactNode } from 'react';

import { AccountHeader } from '@modules/auth';

import { HortaiLogo } from '@components/brand/hortai-logo';

/**
 * The start page's frame: the logo and, for the signed-in parent, the account menu (the page's
 * I18nProvider must carry the `auth` namespace). The screen inside may stream.
 */
export function StartPageShell({ children }: { readonly children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
        <Suspense fallback={<HortaiLogo className="h-10 sm:h-12" />}>
          <AccountHeader />
        </Suspense>
        {children}
      </div>
    </main>
  );
}
