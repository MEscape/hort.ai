import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { AssignmentWorkspace } from '@modules/assignments';

import { HortaiLogo } from '@components/brand/hortai-logo';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Skeleton } from '@components/ui/skeleton';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { serverEnv } from '@lib/config/server';
import { buildPrivateMetadata } from '@lib/seo';

interface TeacherAssignmentsPageProps {
  readonly params: Promise<{ locale: string }>;
}

function requireDevelopmentPreview() {
  if (serverEnv.NODE_ENV !== 'development') {
    notFound();
  }
}

export async function generateMetadata({ params }: TeacherAssignmentsPageProps) {
  requireDevelopmentPreview();
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'assignments' });
  return buildPrivateMetadata(t('overview.title'));
}

async function TeacherAssignmentsContent({ params }: TeacherAssignmentsPageProps) {
  const locale = requireLocale((await params).locale);
  return (
    <I18nProvider locale={locale} namespaces={['assignments']}>
      <AssignmentWorkspace />
    </I18nProvider>
  );
}

export default function TeacherAssignmentsPage(props: TeacherAssignmentsPageProps) {
  requireDevelopmentPreview();
  return (
    <main className="min-h-dvh bg-canvas px-5 py-6 text-copy sm:px-8 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <header>
          <HortaiLogo className="h-12" />
        </header>
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-token-xl" />}>
          <TeacherAssignmentsContent {...props} />
        </Suspense>
      </div>
    </main>
  );
}
