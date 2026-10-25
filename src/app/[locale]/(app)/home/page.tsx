import { Suspense } from 'react';

import { assignmentRoutes, assignmentsQueries } from '@modules/assignments';
import { AccountHeader, AuthShell, requireSignedIn, TEACHER_ROLE } from '@modules/auth';
import { classroomQueries } from '@modules/classroom';
import { getHelpSessionQueries, loadOpenHelpSession } from '@modules/guidance';
import { requireOnboarded } from '@modules/learner';
import { loadProgressDto } from '@modules/progression';
import { FALLBACK_AREA_ID, worldIsland } from '@modules/world';

import { Hort } from '@components/brand/hort';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { Link, requireLocale } from '@i18n';

import { getLocale, getMessages, getTranslations } from '@i18n/server';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import type { AppResultAsync } from '@lib/result';
import { buildPrivateMetadata } from '@lib/seo';
import { isDefined, truncate } from '@lib/utils';

import { loadHomeworkAreaIds } from '@/app/_lib/homework-area-ids';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

import { HomeLoading } from './_components/home-loading';
import { HomeScreen } from './_components/home-screen';

import type { UnfinishedTask, WorldPreviewIsland } from './_components/home-types';

/** The islands the card shows: the start is always clear, the others once the child did homework there. */
const PREVIEW_AREA_IDS = [FALLBACK_AREA_ID, 'zahlenwald', 'maerchenwald'] as const;

const TASK_PREVIEW_LIMIT = 48;

type OpenHelpSession = NonNullable<Awaited<ReturnType<typeof loadOpenHelpSession>>>;

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('home.title'));
}

async function previewIslands(childProfileId: string): Promise<readonly WorldPreviewIsland[]> {
  const { app } = await getMessages();
  const homework = await loadHomeworkAreaIds(childProfileId);
  return PREVIEW_AREA_IDS.map((areaId) =>
    worldIsland(areaId, serverEnv.STORAGE_PUBLIC_BASE_URL, app.world.areas, homework),
  ).filter(isDefined);
}

/** The open help session as the continue card shows it: a few words of the task, never an answer. */
async function unfinishedOf(session: OpenHelpSession | null): Promise<UnfinishedTask | null> {
  if (session === null) {
    return null;
  }
  const t = await getTranslations('app');
  const subjects = {
    math: t('world.subjects.mathe'),
    german: t('world.subjects.deutsch'),
    english: t('world.subjects.sprachenKunst'),
    general_studies: t('world.subjects.natur'),
  } as const satisfies Record<OpenHelpSession['subject'], string>;
  return {
    title: truncate(session.task, TASK_PREVIEW_LIMIT),
    area: subjects[session.subject],
    // The opening thinking prompt (only without a clarify or redirect opening) is not a hint the child asked for.
    lastStep: t('home.continue.hints', {
      count: Math.max(0, session.hints.length - (session.opening === null ? 1 : 0)),
    }),
    updatedAt: session.updatedAt,
    href: '/help',
  };
}

/**
 * Home's optional sources: one that fails must not take the child's whole Home down. It is
 * logged with its code and the card or strip shows its "not available" state instead.
 */
async function valueOrNull<T>(source: string, load: AppResultAsync<T>): Promise<T | null> {
  const result = await load;
  if (result.isOk()) {
    return result.value;
  }
  logger.warn('home.source_unavailable', { source, code: result.error.code });
  return null;
}

/** The open help session, or `null` when there is none or it cannot be read right now. */
async function openSessionOf(childProfileId: string): Promise<OpenHelpSession | null> {
  try {
    return await loadOpenHelpSession(childProfileId);
  } catch (error) {
    // The guard throws with the error code as its message.
    const code = error instanceof Error ? error.message : 'unexpected';
    logger.warn('home.source_unavailable', { source: 'open_help_session', code });
    return null;
  }
}

async function ChildHome() {
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
  const [usedMinutes, assignments, open] = await Promise.all([
    // The same count the use cases enforce the daily limit against; `null` shows "not available".
    valueOrNull(
      'help_minutes',
      getHelpSessionQueries().getTodayHelpMinutes.execute({ childProfileId: child.id }),
    ),
    // shortcut: nothing records which assignment the child opened, so every open one counts as new.
    valueOrNull('assignments', assignmentsQueries.listChildAssignments.execute(child.id)),
    openSessionOf(child.id),
  ]);

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
        usedMinutes,
        // The time strip's live session chip (#17) is not wired yet; the continue card shows it.
        session: null,
        unfinished: await unfinishedOf(open),
        teacherNewCount: assignments === null ? null : assignments.length,
        world: await previewIslands(child.id),
        // The voices speak German and only while the parent's voice control is on; otherwise the
        // lines stay text.
        speech: { speakerId: companion.id, isAllowed: child.voiceConsent && locale === 'de' },
      }}
    />
  );
}

/** A teacher has no child setup (parent onboarding needs `learner.read`): their own short home. */
async function TeacherHome() {
  const t = await getTranslations('app');
  // The classroom query lists only the signed-in teacher's own classes.
  const result = await classroomQueries.listClassrooms.execute();
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  const classrooms = result.value.filter(({ status }) => status === 'active');
  return (
    <AuthShell header={<AccountHeader />}>
      <Card>
        <CardHeader>
          <Hort mood="happy" />
          <h1 className="text-3xl">{t('home.title')}</h1>
        </CardHeader>
        <CardContent>
          <p className="text-center text-copy-muted">{t('home.teacherDescription')}</p>
          {classrooms.length === 0 ? (
            <p className="text-center">{t('home.teacherNoClassroom')}</p>
          ) : (
            <ul aria-label={t('home.teacherClassrooms')} className="w-full space-y-2">
              {classrooms.map((classroom) => (
                <li key={classroom.id}>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={assignmentRoutes.teacherClassroom(classroom.id)}>
                      {t('home.teacherClassroom', { name: classroom.name, grade: classroom.grade })}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button asChild>
            <Link href={assignmentRoutes.teacher()}>{t('home.teacherAssignments')}</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

/**
 * Where the signed-in account goes next. Navigation only: every use case behind these links
 * authorizes the account itself.
 */
async function Home() {
  const actor = await requireSignedIn('/home');
  return actor.roles.includes(TEACHER_ROLE) ? <TeacherHome /> : <ChildHome />;
}

export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider
      locale={locale}
      namespaces={['auth', 'learner', 'classroom', 'progression', 'guidance']}
    >
      <Suspense fallback={<HomeLoading />}>
        <Home />
      </Suspense>
    </I18nProvider>
  );
}
