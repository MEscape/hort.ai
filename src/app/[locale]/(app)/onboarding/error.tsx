'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function OnboardingError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <RouteErrorPanel onRetry={reset} />
    </main>
  );
}
