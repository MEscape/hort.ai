import { Suspense } from 'react';

import { requireSignedIn } from '@modules/auth';
import {
  OnboardingFlow,
  OnboardingShell,
  learnerRoutes,
  requireOnboarding,
} from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { buildTutorOptions } from './tutor-options';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'learner' });
  return buildPrivateMetadata(t('metadata.title'));
}

async function ParentOnboarding() {
  await requireSignedIn(learnerRoutes.onboarding());
  const state = await requireOnboarding();
  return <OnboardingFlow initial={state} tutors={buildTutorOptions()} />;
}

export default async function OnboardingPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['learner']}>
      <OnboardingShell>
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-token-xl" />}>
          <ParentOnboarding />
        </Suspense>
      </OnboardingShell>
    </I18nProvider>
  );
}
