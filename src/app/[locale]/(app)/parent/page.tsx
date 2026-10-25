import { Suspense } from 'react';

import { parentPageSchema } from '@modules/learner';

import { I18nProvider } from '@components/providers/i18n-provider';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { ParentContent } from './_components/parent-content';
import { ParentFrame } from './_components/parent-frame';
import { ParentLoading } from './_components/parent-loading';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations({
    locale: requireLocale((await params).locale),
    namespace: 'learner.dashboard',
  });
  return buildPrivateMetadata(t('eyebrow'));
}

async function ParentArea({ searchParams }: { readonly searchParams: SearchParams }) {
  const { section, range } = parentPageSchema.parse(await searchParams);
  return (
    <ParentFrame section={section} range={range}>
      {(child) => <ParentContent child={child} section={section} range={range} />}
    </ParentFrame>
  );
}

export default async function ParentPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ locale: string }>;
  readonly searchParams: SearchParams;
}) {
  return (
    <I18nProvider
      locale={requireLocale((await params).locale)}
      namespaces={['auth', 'learner', 'classroom']}
    >
      <Suspense fallback={<ParentLoading />}>
        <ParentArea searchParams={searchParams} />
      </Suspense>
    </I18nProvider>
  );
}
