import { Suspense } from 'react';

import { AuthFormSkeleton, requireSignedIn } from '@modules/auth';
import { requireOnboarded } from '@modules/learner';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { TaskScreen } from './_components/task-screen';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'app',
  });
  return buildPrivateMetadata(t('start.metaTitle'));
}

async function Task() {
  await requireSignedIn('/home/task');
  await requireOnboarded();
  return <TaskScreen />;
}

export default function TaskPage() {
  return (
    <Suspense fallback={<AuthFormSkeleton />}>
      <Task />
    </Suspense>
  );
}
