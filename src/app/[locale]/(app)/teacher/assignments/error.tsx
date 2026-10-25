'use client';

import { RouteErrorPanel } from '@components/shared/route-error-panel';

export default function TeacherAssignmentsError({ retry }: { readonly retry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <RouteErrorPanel onRetry={retry} />
    </main>
  );
}
