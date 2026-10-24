import { SignUpForm, authRoutes } from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildLocalizedMetadata({
    locale,
    pathname: authRoutes.signUp(),
    title: t('signUp.metadata.title'),
    description: t('signUp.metadata.description'),
  });
}

export default function SignUpPage() {
  return <SignUpForm />;
}
