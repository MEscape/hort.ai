import { Suspense } from 'react';

import {
  AuthFormSkeleton,
  EmailVerificationResult,
  parseEmailVerifiedPageParams,
} from '@modules/auth';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface RouteProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return buildPrivateMetadata(t('emailVerification.metadata.title'));
}

async function VerificationContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  return <EmailVerificationResult {...parseEmailVerifiedPageParams(await searchParams)} />;
}

export default function EmailVerifiedPage({ searchParams }: RouteProps) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <VerificationContent searchParams={searchParams} />
    </Suspense>
  );
}
