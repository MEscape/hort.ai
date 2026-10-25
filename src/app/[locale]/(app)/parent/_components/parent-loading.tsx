'use client';

import { useTranslations } from '@i18n/client';

/**
 * The shell while the gate and the child's records load; it names no child and shows no counts.
 * A Client Component on the layout's shell texts: a server fallback would resolve the locale from
 * the route params, which on `/parent/tasks/[taskId]` blocks the prerendered shell.
 */
export function ParentLoading() {
  const t = useTranslations('app');
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10" aria-busy="true">
      <p role="status" className="text-copy-muted">
        {t('loading')}
      </p>
    </main>
  );
}
