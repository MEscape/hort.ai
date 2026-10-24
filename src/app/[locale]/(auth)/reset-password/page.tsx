import { Suspense } from 'react';

import {
  AuthFormSkeleton,
  ResetPasswordForm,
  ResetPasswordLinkMissing,
  parseResetPasswordPageParams,
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
  return buildPrivateMetadata(t('resetPassword.metadata.title'));
}

async function ResetPasswordContent({ searchParams }: Pick<RouteProps, 'searchParams'>) {
  const { token } = parseResetPasswordPageParams(await searchParams);
  return token === undefined ? <ResetPasswordLinkMissing /> : <ResetPasswordForm token={token} />;
}

export default function ResetPasswordPage({ searchParams }: RouteProps) {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
