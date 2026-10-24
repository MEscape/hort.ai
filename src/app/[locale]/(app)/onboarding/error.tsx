'use client';

import { PageMain } from '@components/layout/layout-primitives';
import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function OnboardingError({ reset }: { readonly reset: () => void }) {
  return (
    <PageMain variant="centered">
      <RouteErrorPanel onRetry={reset} />
    </PageMain>
  );
}
