import { Suspense } from 'react';
import type { ReactNode } from 'react';

import { assignmentRoutes } from '@modules/assignments';
import {
  AccountHeader,
  AuthFormSkeleton,
  AuthShell,
  isAuthEnabled,
  requireSignedIn,
  TEACHER_ROLE,
} from '@modules/auth';
import { SignOutButton } from '@modules/auth/client';
import { ChildClassroomPanel, classroomQueries } from '@modules/classroom';
import { loadOpenHelpSession } from '@modules/guidance';
import {
  ResetOnboardingButton,
  VoiceConsentSwitch,
  isDevResetAvailable,
  requireOnboarded,
} from '@modules/learner';
import { loadProgressDto } from '@modules/progression';
import { CompanionCard } from '@modules/progression/client';

import { Hort } from '@components/brand/hort';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { buildTutorOptions, preloadTutorPictures } from '../onboarding/tutor-options';

const TASK_PREVIEW_LIMIT = 48;

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('home.title'));
}

async function ChildActions({ child }: { readonly child: { id: string; displayName: string } }) {
  const t = await getTranslations('app');
  // The classroom query authorizes the parent on the stored child profile again.
  const result = await classroomQueries.getChildClassroom.execute(child.id);
  const activeSession = await loadOpenHelpSession(child.id);
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  const membership = result.value;
  return (
    <>
      <Button asChild>
        <Link href={`/start${buildQueryString({ child: child.id })}`}>
          {t('home.startHomework')}
        </Link>
      </Button>
      {activeSession !== null && (
        <Button asChild size="lg">
          <Link href="/help">
            {t('home.continueHelp', { task: activeSession.task.slice(0, TASK_PREVIEW_LIMIT) })}
          </Link>
        </Button>
      )}
      <ChildClassroomPanel
        childProfileId={child.id}
        childName={child.displayName}
        classroom={membership && { name: membership.name, grade: membership.grade }}
      />
    </>
  );
}

/** The card every signed-in home shows; its body depends on the role. */
async function HomeCard({ children }: { readonly children: ReactNode }) {
  const t = await getTranslations('app');
  return (
    <Card>
      <CardHeader>
        <Hort mood="happy" />
        <h1 className="text-3xl">{t('home.title')}</h1>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

async function TeacherHome() {
  const t = await getTranslations('app');
  // The classroom query lists only the signed-in teacher's own classes.
  const result = await classroomQueries.listClassrooms.execute();
  if (result.isErr()) {
    throw new Error(result.error.code, { cause: result.error });
  }
  const classrooms = result.value.filter(({ status }) => status === 'active');
  return (
    <HomeCard>
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
      {isAuthEnabled && <SignOutButton />}
    </HomeCard>
  );
}

async function ParentHome() {
  const child = await requireOnboarded();
  const t = await getTranslations('app');
  const tutors = buildTutorOptions();
  preloadTutorPictures(tutors, child.tutorId);
  const companion = tutors.find((option) => option.id === child.tutorId);
  const progress = companion === undefined ? null : await loadProgressDto(child.id);
  return (
    <div className="flex flex-col gap-6">
      {companion !== undefined && progress !== null && (
        <CompanionCard companion={companion} progress={progress} />
      )}
      <HomeCard>
        <p className="text-center text-copy-muted">{t('home.description')}</p>
        <ChildActions child={child} />
        <VoiceConsentSwitch
          profileId={child.id}
          name={child.displayName}
          allowed={child.voiceConsent}
        />
        {isAuthEnabled && <SignOutButton />}
        {isDevResetAvailable() && <ResetOnboardingButton />}
      </HomeCard>
    </div>
  );
}

/**
 * Where the signed-in account goes next. A teacher has no child setup (parent onboarding needs
 * `learner.read`, which a teacher does not hold), so only parents are sent through it. Navigation
 * only: every use case behind these links authorizes the account itself.
 */
async function Home() {
  const actor = await requireSignedIn('/home');
  return actor.roles.includes(TEACHER_ROLE) ? <TeacherHome /> : <ParentHome />;
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
      <AuthShell header={<AccountHeader />}>
        <Suspense fallback={<AuthFormSkeleton />}>
          <Home />
        </Suspense>
      </AuthShell>
    </I18nProvider>
  );
}
