import type { Metadata } from 'next';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';
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
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-token bg-primary text-primary-foreground shadow-soft"
          >
            <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7">
              <path
                d="M8 23V9m16 14V9M8 16h16"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="m14 6 3-3 3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="font-heading text-2xl font-semibold tracking-tight text-primary-copy">
            {APP_IDENTITY.name}
          </span>
        </header>
        <StartScreen />
      </div>
    </main>
  );
}
