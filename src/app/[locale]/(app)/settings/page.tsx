import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import {
  AccountHeader,
  AccountSettings,
  authRoutes,
  isAuthEnabled,
  requireSignedIn,
} from '@modules/auth';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface SettingsPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: SettingsPageProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('account.title'));
}

/** Account settings exist only with real accounts; the guard redirects a visitor to sign-in. */
async function SettingsContent() {
  if (!isAuthEnabled) {
    notFound();
  }
  await requireSignedIn(authRoutes.settings());
  return <AccountSettings />;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <main className="min-h-dvh bg-canvas px-5 py-6 text-copy sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Suspense fallback={<Skeleton className="h-12 w-full rounded-token-lg" />}>
            <AccountHeader />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-token-xl" />}>
            <SettingsContent />
          </Suspense>
        </div>
      </main>
    </I18nProvider>
  );
}
