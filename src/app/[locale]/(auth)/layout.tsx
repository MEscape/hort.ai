import type { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { AuthShell, isAuthEnabled } from '@modules/auth';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

export default async function AuthLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  if (!isAuthEnabled) {
    notFound();
  }
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <AuthShell>{children}</AuthShell>
    </I18nProvider>
  );
}
