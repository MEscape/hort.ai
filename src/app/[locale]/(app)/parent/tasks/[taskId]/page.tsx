import { Suspense } from 'react';

import { ParentTaskDetail, getParentLearnerServices } from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { orFail } from '@/app/_lib/or-fail';

import { describeTopics } from '../../_components/describe-topics';
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
  const topics = await describeTopics([task.competencyCode]);
  return (
    <ParentTaskDetail
      task={task}
      topic={task.competencyCode === null ? null : (topics[task.competencyCode] ?? null)}
    />
  );
}

/** `params` is read inside Suspense, so the dynamic segment never blocks the prerendered shell. */
async function ParentTaskArea({ params }: { readonly params: Params }) {
  const { locale, taskId } = await params;
  return (
    <I18nProvider locale={requireLocale(locale)} namespaces={['auth', 'learner']}>
      <ParentFrame section="learning" range="week">
        {(child) => <ParentTask profileId={child.id} taskId={taskId} />}
      </ParentFrame>
    </I18nProvider>
  );
}

export default function ParentTaskPage({ params }: { readonly params: Params }) {
  return (
    <Suspense fallback={<ParentLoading />}>
      <ParentTaskArea params={params} />
    </Suspense>
  );
}
