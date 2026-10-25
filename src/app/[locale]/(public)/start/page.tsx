import { redirect, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'app',
  });
  return buildPrivateMetadata(t('home.title'));
}

/** Compatibility only: the obsolete public dashboard has been removed. Home enforces authentication. */
export default async function StartPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  redirect({ href: '/home', locale: requireLocale((await params).locale) });
}
