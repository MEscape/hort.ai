'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

/** Failed reads are not shown as an empty child history. The shared boundary supports retry. */
export default function ParentError({ reset }: { readonly reset: () => void }) {
  return <RouteErrorPanel onRetry={reset} />;
}
