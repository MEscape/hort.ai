import { ParentAccessForm, ReturnToChildButton, isAuthEnabled } from '@modules/auth';

import { Lock } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

/** No child profile, counts or settings are loaded before the server gate succeeds. */
export async function ParentGate() {
  const t = await getTranslations('learner.dashboard');
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
      <div className="rounded-token-xl border border-border bg-surface p-6 shadow-soft sm:p-8">
        <Lock aria-hidden="true" className="mb-5 size-8 text-primary-copy" />
        <h1 className="font-heading text-3xl">{t('gateTitle')}</h1>
        <p className="mt-3 mb-6 text-copy-muted">{t('gateDescription')}</p>
        {isAuthEnabled ? <ParentAccessForm /> : <p>{t('gateUnavailable')}</p>}
      </div>
      <ReturnToChildButton />
    </main>
  );
}
