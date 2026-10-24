'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function AuthError({ reset }: { readonly reset: () => void }) {
  return <RouteErrorPanel onRetry={reset} />;
}
