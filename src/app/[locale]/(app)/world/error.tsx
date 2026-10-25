'use client';

import { PageMain } from '@components/layout/layout-primitives';
import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function WorldError({ reset }: { readonly reset: () => void }) {
  return (
    <PageMain variant="centered">
      <RouteErrorPanel onRetry={reset} />
    </PageMain>
  );
}
