import { ForgotPasswordForm, authRoutes } from '@modules/auth';

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
    pathname: authRoutes.forgotPassword(),
    title: t('forgotPassword.metadata.title'),
    description: t('forgotPassword.metadata.description'),
  });
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
