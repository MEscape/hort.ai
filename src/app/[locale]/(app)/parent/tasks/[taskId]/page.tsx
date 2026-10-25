import { Suspense } from 'react';

import { ParentTaskDetail, getParentLearnerServices } from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

import { ParentFrame } from '../../_components/parent-frame';
import { ParentLoading } from '../../_components/parent-loading';

type Params = Promise<{ locale: string; taskId: string }>;

export async function generateMetadata({ params }: { readonly params: Params }) {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'learner.dashboard',
  });
  return buildPrivateMetadata(t('taskDetails'));
}

async function ParentTask({
  profileId,
  taskId,
}: {
  readonly profileId: string;
  readonly taskId: string;
}) {
  const task = await orFail(getParentLearnerServices().getTask.execute({ profileId, taskId }));
  return <ParentTaskDetail task={task} />;
}

/** `params` is read inside Suspense, so the dynamic segment never blocks the prerendered shell. */
async function ParentTaskArea({ params }: { readonly params: Params }) {
  const { taskId } = await params;
  return (
    <ParentFrame section="learning" range="week">
      {(child) => <ParentTask profileId={child.id} taskId={taskId} />}
    </ParentFrame>
  );
}

export default async function ParentTaskPage({ params }: { readonly params: Params }) {
  return (
    <I18nProvider locale={requireLocale((await params).locale)} namespaces={['auth', 'learner']}>
      <Suspense fallback={<ParentLoading />}>
        <ParentTaskArea params={params} />
      </Suspense>
    </I18nProvider>
  );
}
