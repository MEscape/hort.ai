import { Suspense } from 'react';

import { requireSignedIn } from '@modules/auth';
import { learnerRoutes, requireOnboarded } from '@modules/learner';
import { loadLessonDto } from '@modules/lesson';
import { LessonPlayer, lessonRoutes } from '@modules/lesson/client';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

/** The vertical slice runs one lesson; a lesson picker replaces this when there are more. */
const SLICE_LESSON_ID = 'compare-fractions';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'lesson' });
  return buildPrivateMetadata(t('lessons.compare-fractions.title'));
}

async function LessonContent() {
  await requireSignedIn(lessonRoutes.play());
  const child = await requireOnboarded();
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, child.tutorId);
  const companion = tutors.find((option) => option.id === child.tutorId) ?? tutors[0];
  const lesson = await loadLessonDto(child.id, SLICE_LESSON_ID);
  if (companion === undefined) {
    throw new Error('No companion is available.');
  }
  return <LessonPlayer childProfileId={child.id} lesson={lesson} companion={companion} />;
}

export default async function LearnPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'lesson' });
  return (
    <I18nProvider locale={locale} namespaces={['lesson']}>
      <main className="mx-auto flex h-dvh w-full max-w-5xl flex-col gap-3 px-4 pt-3 pb-safe sm:px-6">
        <Button asChild variant="ghost" className="self-start">
          <Link href={learnerRoutes.home()}>
            <ArrowLeft aria-hidden="true" />
            {t('stage.home')}
          </Link>
        </Button>
        <Suspense fallback={<div className="flex-1 animate-pulse rounded-token-xl bg-world" />}>
          <LessonContent />
        </Suspense>
      </main>
    </I18nProvider>
  );
}
