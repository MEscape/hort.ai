import { Suspense } from 'react';

import {
  assignmentRoutes,
  assignmentsQueries,
  FirstClassroomPanel,
  parseTeacherAssignmentsPageParams,
  TeacherAssignmentWorkspace,
  TeachersOnlyNotice,
} from '@modules/assignments';
import type { TeacherAssignmentOverview } from '@modules/assignments';
import { AccountHeader, requireSignedIn } from '@modules/auth';
import {
  AddClassroomDialog,
  ClassroomCreationProvider,
  ClassroomDetailsDialog,
  classroomQueries,
  CreateClassroomForm,
} from '@modules/classroom';

import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

interface TeacherAssignmentsPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: TeacherAssignmentsPageProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'assignments' });
  return buildPrivateMetadata(t('page.title'));
}

/**
 * A class's details dialog, when `?details=` names one. The classroom query checks it is one of the
 * signed-in teacher's classes; anything else (a guess, another teacher's class) shows no dialog.
 */
async function ClassroomDetails({
  selectedClassroomId,
  detailsClassroomId,
}: {
  readonly selectedClassroomId: string;
  readonly detailsClassroomId: string;
}) {
  const result = await classroomQueries.getClassroomDetails.execute(detailsClassroomId);
  if (result.isErr()) {
    if (result.error.kind === 'infrastructure') {
      throw new Error(result.error.code, { cause: result.error });
    }
    return null;
  }
  return (
    <ClassroomDetailsDialog
      key={detailsClassroomId}
      details={result.value}
      closeHref={assignmentRoutes.teacherClassroom(selectedClassroomId)}
    />
  );
}

function Overview({
  overview,
  detailsClassroomId,
}: {
  readonly overview: TeacherAssignmentOverview;
  readonly detailsClassroomId: string | undefined;
}) {
  const selected = overview.classrooms.find(({ id }) => id === overview.selectedClassroomId);
  if (selected === undefined) {
    return (
      <FirstClassroomPanel>
        <CreateClassroomForm />
      </FirstClassroomPanel>
    );
  }
  return (
    <>
      <TeacherAssignmentWorkspace
        key={selected.id}
        classrooms={overview.classrooms}
        classroomId={selected.id}
        classroomName={selected.name}
        assignments={overview.assignments}
        classroomActions={<AddClassroomDialog />}
      />
      {detailsClassroomId !== undefined && (
        <ClassroomDetails
          selectedClassroomId={selected.id}
          detailsClassroomId={detailsClassroomId}
        />
      )}
    </>
  );
}

/**
 * The guard only redirects a visitor who is not signed in. Authorization happens in the use case:
 * a parent is refused (`assignment.read`) and sees the teachers-only notice, never a class.
 */
async function TeacherAssignmentsContent({
  searchParams,
}: Pick<TeacherAssignmentsPageProps, 'searchParams'>) {
  const { classroomId, detailsClassroomId } = parseTeacherAssignmentsPageParams(await searchParams);
  await requireSignedIn(
    classroomId === undefined
      ? assignmentRoutes.teacher()
      : assignmentRoutes.teacherClassroom(classroomId),
  );
  const result = await assignmentsQueries.getTeacherAssignmentOverview.execute(classroomId);

  if (result.isOk()) {
    return <Overview overview={result.value} detailsClassroomId={detailsClassroomId} />;
  }
  if (result.error.kind === 'forbidden') {
    return <TeachersOnlyNotice />;
  }
  throw new Error(result.error.code, { cause: result.error });
}

export default async function TeacherAssignmentsPage({
  params,
  searchParams,
}: TeacherAssignmentsPageProps) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['assignments', 'classroom', 'auth']}>
      <main className="min-h-dvh bg-canvas px-5 py-6 text-copy sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <Suspense fallback={<Skeleton className="h-12 w-full rounded-token-lg" />}>
            <AccountHeader />
          </Suspense>
          {/* Above both branches below, so the "class created" dialog outlives their switch. */}
          <ClassroomCreationProvider>
            <Suspense fallback={<Skeleton className="h-80 w-full rounded-token-xl" />}>
              <TeacherAssignmentsContent searchParams={searchParams} />
            </Suspense>
          </ClassroomCreationProvider>
        </div>
      </main>
    </I18nProvider>
  );
}
