import { Suspense } from 'react';

import { AuthFormSkeleton, SignInForm, authRoutes, parseSignInPageParams } from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildLocalizedMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildLocalizedMetadata({
    locale,
    pathname: authRoutes.signIn(),
    title: t('signIn.metadata.title'),
    description: t('signIn.metadata.description'),
  });
}

async function SignInContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  return <SignInForm {...parseSignInPageParams(await searchParams)} />;
}

export default function SignInPage({ searchParams }: RouteProps) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}
