import { Suspense } from 'react';

import {
  assignmentRoutes,
  assignmentsQueries,
  ClassroomPicker,
  FirstClassroomPanel,
  parseTeacherAssignmentsPageParams,
  TeacherAssignmentWorkspace,
  TeachersOnlyNotice,
} from '@modules/assignments';
import type { TeacherAssignmentOverview } from '@modules/assignments';
import { requireSignedIn } from '@modules/auth';
import { CreateClassroomForm } from '@modules/classroom';

import { HortaiLogo } from '@components/brand/hortai-logo';
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

function Overview({ overview }: { readonly overview: TeacherAssignmentOverview }) {
  const selected = overview.classrooms.find(({ id }) => id === overview.selectedClassroomId);
  if (selected === undefined) {
    return (
      <FirstClassroomPanel>
        <CreateClassroomForm />
      </FirstClassroomPanel>
    );
  }
  return (
    <div className="space-y-6">
      <ClassroomPicker classrooms={overview.classrooms} selectedClassroomId={selected.id} />
      <TeacherAssignmentWorkspace
        key={selected.id}
        classroomId={selected.id}
        classroomName={selected.name}
        assignments={overview.assignments}
      />
    </div>
  );
}

/**
 * The guard only redirects a visitor who is not signed in. Authorization happens in the use case:
 * a parent is refused (`assignment.read`) and sees the teachers-only notice, never a class.
 */
async function TeacherAssignmentsContent({
  searchParams,
}: Pick<TeacherAssignmentsPageProps, 'searchParams'>) {
  const { classroomId } = parseTeacherAssignmentsPageParams(await searchParams);
  await requireSignedIn(
    classroomId === undefined
      ? assignmentRoutes.teacher()
      : assignmentRoutes.teacherClassroom(classroomId),
  );
  const result = await assignmentsQueries.getTeacherAssignmentOverview.execute(classroomId);

  if (result.isOk()) {
    return <Overview overview={result.value} />;
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
    <main className="min-h-dvh bg-canvas px-5 py-6 text-copy sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <HortaiLogo className="h-12" />
        </header>
        <I18nProvider locale={locale} namespaces={['assignments', 'classroom']}>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-token-xl" />}>
            <TeacherAssignmentsContent searchParams={searchParams} />
          </Suspense>
        </I18nProvider>
      </div>
    </main>
  );
}
