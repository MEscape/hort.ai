import { getTranslations } from '@i18n/server';

/** The shell while the gate and the child's records load; it names no child and shows no counts. */
export async function ParentLoading() {
  const t = await getTranslations('learner.dashboard');
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10" aria-busy="true">
      <p role="status" className="text-copy-muted">
        {t('loading')}
      </p>
    </main>
  );
}
