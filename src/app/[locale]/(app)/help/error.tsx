'use client';

import { PageMain } from '@components/layout/layout-primitives';
import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function HelpError({ retry }: { readonly retry: () => void }) {
  return (
    <PageMain variant="centered">
      <RouteErrorPanel onRetry={retry} />
    </PageMain>
  );
}
