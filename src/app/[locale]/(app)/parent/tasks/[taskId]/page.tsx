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

/**
 * The segment is untrusted and per request: one placeholder id lets the build prerender the shell
 * (the layout reads the locale), every other id renders on demand.
 */
export function generateStaticParams() {
  return [{ taskId: 'placeholder' }];
}

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

/**
 * The provider sits outside Suspense, as on the parent overview, so the loading shell translates
 * from the request locale; only the signed-in, per-child part is read inside Suspense.
 */
function ParentTaskArea({ taskId }: { readonly taskId: string }) {
  return (
    <ParentFrame section="learning" range="week">
      {(child) => <ParentTask profileId={child.id} taskId={taskId} />}
    </ParentFrame>
  );
}

export default async function ParentTaskPage({ params }: { readonly params: Params }) {
  const { locale, taskId } = await params;
  return (
    <I18nProvider locale={requireLocale(locale)} namespaces={['auth', 'learner']}>
      <Suspense fallback={<ParentLoading />}>
        <ParentTaskArea taskId={taskId} />
      </Suspense>
    </I18nProvider>
  );
}
