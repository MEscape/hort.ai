import type { Metadata } from 'next';

import { requireLocale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { APP_IDENTITY } from '@lib/config';
import { buildPrivateMetadata } from '@lib/seo';

import { ComponentShowcase } from './_components/component-showcase';
import { FoundationsShowcase } from './_components/foundations-showcase';
import { LessonSpecimen } from './_components/lesson-specimen';

interface DesignSystemPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: DesignSystemPageProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('designSystem.metaTitle'));
}

export default async function DesignSystemPage({ params }: DesignSystemPageProps) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });

  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl space-y-14 px-5 py-8 sm:px-8 lg:py-12">
        <header
          data-world="stargaze"
          className="relative isolate overflow-hidden rounded-token-xl border border-border bg-world p-7 shadow-soft sm:p-12"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-12 h-60 w-60 rounded-full border-8 border-accent opacity-40"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-20 -bottom-20 h-44 w-44 rounded-full bg-bloom opacity-20"
          />
          <div className="relative max-w-3xl">
            <p className="font-heading text-sm font-semibold tracking-widest text-primary-copy uppercase">
              {APP_IDENTITY.name} / {t('designSystem.eyebrow')}
            </p>
            <h1 className="mt-5 font-heading text-display font-semibold text-copy sm:text-5xl">
              {t('designSystem.title')}
            </h1>
            <p className="measure mt-5 text-lead text-copy-muted">{t('designSystem.intro')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <span className="rounded-token bg-primary px-4 py-2 font-heading text-sm font-semibold text-primary-foreground">
                {t('designSystem.draft')}
              </span>
              <p className="max-w-lg text-sm text-copy-muted">{t('designSystem.note')}</p>
            </div>
          </div>
        </header>

        <FoundationsShowcase locale={locale} />
        <ComponentShowcase locale={locale} />
        <LessonSpecimen />

        <footer className="rounded-token-xl bg-primary px-6 py-7 text-center font-heading text-xl text-primary-foreground sm:px-10">
          {t('designSystem.footer')}
        </footer>
      </div>
    </main>
  );
}
