import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import {
  AccountSettings,
  ParentAccessForm,
  authRoutes,
  getParentAreaServices,
  isAuthEnabled,
  parseSettingsPageParams,
  requireSignedIn,
} from '@modules/auth';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';
import { Skeleton } from '@components/ui/skeleton';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { escalate } from '@lib/errors/escalate';
import { buildPrivateMetadata } from '@lib/seo';

interface SettingsPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: SettingsPageProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('account.title'));
}

/**
 * Account settings exist only with real accounts; the guard redirects a visitor to sign-in. They
 * are an adult area like the parent pages: the child shares the family session, so the account
 * (e-mail, password) is shown only with the short-lived parent password proof, else its form. The
 * account menu is not shown here: the page is the account, a back arrow leads where it came from.
 */
async function SettingsContent({ searchParams }: Pick<SettingsPageProps, 'searchParams'>) {
  if (!isAuthEnabled) {
    notFound();
  }
  const { backHref } = parseSettingsPageParams(await searchParams);
  await requireSignedIn(authRoutes.settings(backHref));
  const t = await getTranslations('auth');
  const access = await getParentAreaServices().require.execute();
  if (access.isErr() && access.error.kind === 'infrastructure') {
    escalate(access.error);
  }
  return (
    <>
      <Button asChild variant="ghost" className="-ml-2 gap-2 px-2">
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" />
          {t('account.back')}
        </Link>
      </Button>
      {access.isOk() ? (
        <AccountSettings />
      ) : (
        <section className="space-y-4 rounded-token-xl border border-border bg-surface p-6 shadow-soft">
          <h1 className="font-heading text-3xl">{t('account.title')}</h1>
          <ParentAccessForm />
        </section>
      )}
    </>
  );
}

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <main className="min-h-dvh bg-canvas px-5 py-6 text-copy sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-token-xl" />}>
            <SettingsContent searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </I18nProvider>
  );
}
