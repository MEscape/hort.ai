import { Suspense } from 'react';

import { requireSignedIn } from '@modules/auth';
import { learnerRoutes, requireChildWelcome } from '@modules/learner';
import { loadProgressDto } from '@modules/progression';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

import { StepBackdrop } from './_components/step-backdrop';
import { WelcomeFlow } from './_components/welcome-flow';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'learner' });
  return buildPrivateMetadata(t('childWelcome.metadata.title'));
}

async function ChildWelcome() {
  await requireSignedIn(learnerRoutes.welcome());
  const profile = await requireChildWelcome();
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, profile.tutorId);
  const progress = await loadProgressDto(profile.id);
  // A fresh key per server render, as on the onboarding page: the router restores the state of a
  // page the child left, and the welcome must start from what the backend stored.
  return (
    <WelcomeFlow key={crypto.randomUUID()} profile={profile} tutors={tutors} progress={progress} />
  );
}

export default async function WelcomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['learner', 'progression']}>
      <Suspense
        fallback={
          // The same scene the flow stands in, so nothing flashes between loading and the first screen.
          <div className="relative isolate min-h-dvh">
            <StepBackdrop />
          </div>
        }
      >
        <ChildWelcome />
      </Suspense>
    </I18nProvider>
  );
}
