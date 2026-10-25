import { Suspense } from 'react';

import { assignmentRoutes } from '@modules/assignments';
import {
  AuthFormSkeleton,
  AuthShell,
  isAuthEnabled,
  requireSignedIn,
  TEACHER_ROLE,
} from '@modules/auth';
import { SignOutButton } from '@modules/auth/client';
import { ChildClassroomPanel, classroomQueries } from '@modules/classroom';
import { ResetOnboardingButton, isDevResetAvailable, requireOnboarded } from '@modules/learner';

import { Hort } from '@components/brand/hort';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { Link, requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('home.title'));
}

/**
 * Where the signed-in account goes next. A teacher has no child setup (parent onboarding needs
 * `learner.read`, which a teacher does not hold), so only parents are sent through it. Navigation
 * only: every use case behind these links authorizes the account itself.
 */
async function ChildActions({ child }: { readonly child: { id: string; displayName: string } }) {
  const t = await getTranslations('app');
  // The classroom query authorizes the parent on the stored child profile again.
  const result = await classroomQueries.getChildClassroom.execute(child.id);
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
      <ChildClassroomPanel
        childProfileId={child.id}
        childName={child.displayName}
        classroom={membership && { name: membership.name, grade: membership.grade }}
      />
    </>
  );
}

async function Home() {
  const actor = await requireSignedIn('/home');
  const t = await getTranslations('app');
  const isTeacher = actor.roles.includes(TEACHER_ROLE);
  const child = isTeacher ? null : (await requireOnboarded()).profile;

  return (
    <Card>
      <CardHeader>
        <Hort mood="happy" />
        <h1 className="text-3xl">{t('home.title')}</h1>
      </CardHeader>
      <CardContent>
        <p className="text-center text-copy-muted">
          {isTeacher ? t('home.teacherDescription') : t('home.description')}
        </p>
        {isTeacher && (
          <Button asChild>
            <Link href={assignmentRoutes.teacher()}>{t('home.teacherAssignments')}</Link>
          </Button>
        )}
        {child !== null && <ChildActions child={child} />}
        {isAuthEnabled && <SignOutButton />}
        {!isTeacher && isDevResetAvailable() && <ResetOnboardingButton />}
      </CardContent>
    </Card>
  );
}

export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['auth', 'learner', 'classroom']}>
      <AuthShell>
        <Suspense fallback={<AuthFormSkeleton />}>
          <Home />
        </Suspense>
      </AuthShell>
    </I18nProvider>
  );
}
