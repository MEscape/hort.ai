'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function AuthError({ retry }: { readonly retry: () => void }) {
  return <RouteErrorPanel onRetry={retry} />;
}
