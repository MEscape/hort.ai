import { Suspense } from 'react';

import { assignmentsQueries } from '@modules/assignments';
import type { ChildAssignmentView } from '@modules/assignments';
import { requireSignedIn } from '@modules/auth';
import { loadOpenHelpSession } from '@modules/guidance';
import { HelpConversation } from '@modules/guidance/client';
import { learnerRoutes, requireOnboarded } from '@modules/learner';
import { loadTaskSceneDto } from '@modules/lesson';
import { TaskScene } from '@modules/lesson/client';
import { islandTopic, worldIsland } from '@modules/world';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link, requireLocale } from '@i18n';

import { getMessages, getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { loadHomeworkAreaIds } from '@/app/_lib/homework-area-ids';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

import { HelpAsk } from './_components/help-ask';
import { HelpLoading } from './_components/help-loading';

import type { StartTopic } from './_components/help-ask';

interface HelpPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Pick<HelpPageProps, 'params'>) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'guidance' });
  return buildPrivateMetadata(t('conversation.taskTitle'));
}

/**
 * `?area=&place=` from an island's link, validated against the world and the child's own islands:
 * only a cleared island counts (the server ignores any other), and an unreadable record means none.
 */
async function topicOf(
  childProfileId: string,
  area: unknown,
  place: unknown,
): Promise<StartTopic | null> {
  const topic = islandTopic(
    typeof area === 'string' ? area : undefined,
    typeof place === 'string' ? place : undefined,
  );
  if (topic === null) {
    return null;
  }
  const { app } = await getMessages();
  const cleared = await loadHomeworkAreaIds(childProfileId);
  const island = worldIsland(topic.areaId, undefined, app.world.areas, cleared);
  if (island?.discovery !== 'revealed') {
    return null;
  }
  const placeName = island.locations.find((location) => location.id === topic.placeId)?.name;
  return {
    areaId: topic.areaId,
    placeId: topic.placeId,
    subject: topic.subject,
    name: [island.name, placeName].filter(Boolean).join(' · '),
  };
}

/**
 * The class's assignments for the child, or `null` when none can be shown. The query authorizes
 * the signed-in parent and the child's membership itself; only an outage is unexpected.
 */
async function loadAssignments(
  childProfileId: string,
): Promise<readonly ChildAssignmentView[] | null> {
  const result = await assignmentsQueries.listChildAssignments.execute(childProfileId);
  if (result.isOk()) {
    return result.value;
  }
  if (result.error.kind === 'infrastructure') {
    throw new Error(result.error.code, { cause: result.error });
  }
  return null;
}

/**
 * One canvas screen for homework help (R-021): the open task with a similar example to try, or,
 * when none is open (or `?new=1` asks for another), the companion asking for the task.
 */
async function HelpContent({ searchParams }: Pick<HelpPageProps, 'searchParams'>) {
  await requireSignedIn('/help');
  const child = await requireOnboarded();
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, child.tutorId);
  const companion = tutors.find((option) => option.id === child.tutorId) ?? tutors[0];
  if (companion === undefined) {
    throw new Error('No companion is available.');
  }
  const params = await searchParams;
  const open = await loadOpenHelpSession(child.id);
  // An island's start link (`?area=`) and "new task" (`?new=1`) ask for a task even while one is open.
  if (open !== null && params['new'] !== '1' && params['area'] === undefined) {
    const scene = await loadTaskSceneDto(child.id);
    return (
      <HelpConversation
        key={open.sessionId}
        childProfileId={child.id}
        initial={open}
        companion={companion}
        scene={scene === null ? null : <TaskScene childProfileId={child.id} view={scene} />}
        voiceConsent={child.voiceConsent}
      />
    );
  }
  return (
    <HelpAsk
      childProfileId={child.id}
      companion={companion}
      openTask={open === null ? null : { task: open.task, assignmentId: open.assignmentId }}
      topic={await topicOf(child.id, params['area'], params['place'])}
      assignments={await loadAssignments(child.id)}
      voiceConsent={child.voiceConsent}
    />
  );
}

export default async function HelpPage({ params, searchParams }: HelpPageProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'guidance' });
  return (
    <I18nProvider locale={locale} namespaces={['guidance', 'lesson', 'assignments', 'voice']}>
      <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-3 px-4 pt-3 pb-safe sm:px-6 lg:h-dvh">
        <Button asChild variant="ghost" className="self-start">
          <Link href={learnerRoutes.home()}>
            <ArrowLeft aria-hidden="true" />
            {t('conversation.later')}
          </Link>
        </Button>
        <Suspense fallback={<HelpLoading />}>
          <HelpContent searchParams={searchParams} />
        </Suspense>
      </main>
    </I18nProvider>
  );
}
