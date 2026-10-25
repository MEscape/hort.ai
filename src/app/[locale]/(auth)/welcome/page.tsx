import { Suspense } from 'react';

import { AuthFormSkeleton, WelcomePanel, authRoutes, redirectIfSignedIn } from '@modules/auth';

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
    pathname: authRoutes.welcome(),
    title: t('welcome.metadata.title'),
    description: t('welcome.metadata.description'),
  });
}

/** A visitor who is already signed in never sees "register or sign in" again. */
async function FrontDoor() {
  await redirectIfSignedIn();
  return <WelcomePanel />;
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <FrontDoor />
    </Suspense>
  );
}
