import { Suspense } from 'react';

import { requireSignedIn, TEACHER_ROLE } from '@modules/auth';
import {
  OnboardingFlow,
  OnboardingShell,
  learnerRoutes,
  requireOnboarding,
} from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { redirect, requireLocale } from '@i18n';

import { getLocale, getTranslations } from '@i18n/server';

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
  const actor = await requireSignedIn(learnerRoutes.onboarding());
  // A teacher has no child to set up; the home page leads them to their classes instead.
  if (actor.roles.includes(TEACHER_ROLE)) {
    redirect({ href: learnerRoutes.home(), locale: await getLocale() });
  }
  const state = await requireOnboarding();
  // A fresh key per server render: the browser keeps the state of a page it left (the router
  // restores it), so without this a reset or a second visit could show the screen of the last visit.
  return <OnboardingFlow key={crypto.randomUUID()} initial={state} tutors={buildTutorOptions()} />;
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
