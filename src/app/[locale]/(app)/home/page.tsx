import { Suspense } from 'react';

import { AuthFormSkeleton, AuthShell, isAuthEnabled, requireSignedIn } from '@modules/auth';
import { SignOutButton } from '@modules/auth/client';
import { ResetOnboardingButton, isDevResetAvailable, requireOnboarded } from '@modules/learner';
import { loadProgressDto } from '@modules/progression';
import { CompanionCard } from '@modules/progression/client';

import { Hort } from '@components/brand/hort';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('home.title'));
}

async function ParentHome() {
  await requireSignedIn('/home');
  const profile = await requireOnboarded();
  const t = await getTranslations('app');
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, profile.tutorId);
  const companion = tutors.find((option) => option.id === profile.tutorId);
  const progress = companion === undefined ? null : await loadProgressDto(profile.id);
  return (
    <div className="flex flex-col gap-6">
      {companion !== undefined && progress !== null && (
        <CompanionCard companion={companion} progress={progress} />
      )}
      <Card>
        <CardHeader>
          <Hort mood="happy" />
          <h1 className="text-3xl">{t('home.title')}</h1>
        </CardHeader>
        <CardContent>
          <p className="text-center text-copy-muted">{t('home.description')}</p>
          {isAuthEnabled && <SignOutButton />}
          {isDevResetAvailable() && <ResetOnboardingButton />}
        </CardContent>
      </Card>
    </div>
  );
}

export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['auth', 'learner', 'progression']}>
      <AuthShell>
        <Suspense fallback={<AuthFormSkeleton />}>
          <ParentHome />
        </Suspense>
      </AuthShell>
    </I18nProvider>
  );
}
