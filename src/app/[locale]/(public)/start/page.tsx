import type { Metadata } from 'next';

import { HortaiLogo } from '@components/brand/hortai-logo';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';

import { StartScreen } from './_components/start-screen';

interface StartPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: StartPageProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('start.metaTitle'));
}

export default async function StartPage({ params }: StartPageProps) {
  requireLocale((await params).locale);

  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-7">
        <header>
          <HortaiLogo className="h-10 sm:h-12" />
        </header>
        <StartScreen />
      </div>
    </main>
  );
}
