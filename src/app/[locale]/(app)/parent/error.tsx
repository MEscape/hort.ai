'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

/**
 * Failed reads are not shown as an empty child history. `retry` re-fetches the server data, so a
 * short database outage recovers; `reset` would only re-render the same failure.
 */
export default function ParentError({ retry }: { readonly retry: () => void }) {
  return <RouteErrorPanel onRetry={retry} />;
}
