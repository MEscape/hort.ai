import { Suspense } from 'react';

import type { Metadata } from 'next';

import { assignmentsQueries, parseChildTasksPageParams } from '@modules/assignments';
import type { ChildAssignmentView } from '@modules/assignments';
import { requireSignedIn } from '@modules/auth';
import { getLearnerQueries, requireOnboarded } from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { StartHeader } from './_components/start-header';
import { StartPageShell } from './_components/start-page-shell';
import { StartScreen } from './_components/start-screen';

interface StartPageProps {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: StartPageProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('start.metaTitle'));
}

/**
 * The assignments of the named child's class, or `null` when there is no child to show them for.
 * The query authorizes the signed-in parent and the child's membership itself; a child that is not
 * theirs (or a teacher, who has no children) gets the plain "not available" state, nothing more.
 */
async function loadSchoolAssignments(
  searchParams: StartPageProps['searchParams'],
): Promise<readonly ChildAssignmentView[] | null> {
  const { childProfileId } = parseChildTasksPageParams(await searchParams);
  if (childProfileId === undefined) {
    return null;
  }
  await requireSignedIn(`/start${buildQueryString({ child: childProfileId })}`);
  const result = await assignmentsQueries.listChildAssignments.execute(childProfileId);
  if (result.isOk()) {
    return result.value;
  }
  if (result.error.kind === 'infrastructure') {
    throw new Error(result.error.code, { cause: result.error });
  }
  return null;
}

async function StartContent({ searchParams }: Pick<StartPageProps, 'searchParams'>) {
  const params = await searchParams;
  const parsed = parseChildTasksPageParams(params);
  const childProfileId = parsed.childProfileId ?? (await requireOnboarded()).id;
  const profile = await getLearnerQueries().getChildProfileById.execute(childProfileId);
  const voiceConsent = profile.isOk() && profile.value.voiceConsent;
  return (
    <StartScreen
      schoolAssignments={await loadSchoolAssignments(
        Promise.resolve({ ...params, child: childProfileId }),
      )}
      childProfileId={childProfileId}
      voiceConsent={voiceConsent}
    />
  );
}

export default async function StartPage({ params, searchParams }: StartPageProps) {
  const locale = requireLocale((await params).locale);

  return (
    <I18nProvider locale={locale} namespaces={['assignments', 'voice']}>
      <StartPageShell header={<StartHeader />}>
        <Suspense fallback={<StartScreen schoolAssignments={null} childProfileId={null} />}>
          <StartContent searchParams={searchParams} />
        </Suspense>
      </StartPageShell>
    </I18nProvider>
  );
}
