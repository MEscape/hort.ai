import { Suspense } from 'react';

import { requireSignedIn } from '@modules/auth';
import { requireOnboarded } from '@modules/learner';
import { loadProgressDto } from '@modules/progression';
import { FALLBACK_AREA_ID, worldIsland } from '@modules/world';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getLocale, getMessages, getTranslations } from '@i18n/server';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { buildPrivateMetadata } from '@lib/seo';
import { isDefined } from '@lib/utils';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

import { HomeLoading } from './_components/home-loading';
import { HomeScreen } from './_components/home-screen';

import type { WorldPreviewIsland } from './_components/home-types';

/** The islands the card shows. Only the starting island is clear: nothing records a discovery yet. */
const PREVIEW_AREA_IDS = [FALLBACK_AREA_ID, 'zahlenwald', 'maerchenwald'] as const;

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('home.title'));
}

async function previewIslands(): Promise<readonly WorldPreviewIsland[]> {
  const { app } = await getMessages();
  return PREVIEW_AREA_IDS.map((areaId) =>
    worldIsland(areaId, serverEnv.STORAGE_PUBLIC_BASE_URL, app.world.areas),
  ).filter(isDefined);
}

async function ChildHome() {
  await requireSignedIn('/home');
  const child = await requireOnboarded();
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, child.tutorId);
  const companion = tutors.find((option) => option.id === child.tutorId);
  const progress = companion === undefined ? null : await loadProgressDto(child.id);
  if (companion === undefined || progress === null) {
    throw new Error('home.companion_missing');
  }
  const now = systemClock.now();
  const locale = await getLocale();

  return (
    <HomeScreen
      companion={companion}
      progress={progress}
      data={{
        childName: child.displayName,
        hasVoice: child.voiceConsent,
        controls: {
          dailyLimitMinutes: child.dailyLimitMinutes,
          allowedWindow: child.allowedWindow,
        },
        serverNow: now.toISOString(),
        // Nothing measures learning time yet, so a daily limit shows "time not available".
        usedMinutes: null,
        // Sessions (#17), teacher assignments (#33) and discoveries have no backend yet.
        session: null,
        unfinished: null,
        teacherNewCount: null,
        world: await previewIslands(),
        // The voices speak German and only while the parent's voice control is on; otherwise the
        // lines stay text.
        speech: { speakerId: companion.id, isAllowed: child.voiceConsent && locale === 'de' },
      }}
    />
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
      <Suspense fallback={<HomeLoading />}>
        <ChildHome />
      </Suspense>
    </I18nProvider>
  );
}
