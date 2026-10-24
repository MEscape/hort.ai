import type { ReactNode } from 'react';

import { Link, type Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

interface SectionPageProps {
  readonly locale: Locale;
  readonly title: string;
  readonly description: string;
  readonly sourcePath: string;
  readonly children: ReactNode;
}

export async function SectionPage({
  locale,
  title,
  description,
  sourcePath,
  children,
}: SectionPageProps) {
  const t = await getTranslations({ locale, namespace: 'app' });

  return (
    <main className="min-h-dvh bg-canvas text-copy">
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 lg:py-12">
        <Link
          href="/design-system"
          locale={locale}
          className="inline-flex min-h-12 items-center rounded-token px-2 font-heading font-semibold text-primary-copy underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
        >
          {t('designSystem.backToOverview')}
        </Link>

        <header className="space-y-4 rounded-token-xl border border-border bg-surface p-6 shadow-soft sm:p-8">
          <h1 className="font-heading text-3xl font-semibold text-copy sm:text-4xl">{title}</h1>
          <p className="measure text-copy-muted">{description}</p>
          <p className="text-sm font-semibold text-primary-copy">{t('designSystem.sourceFile')}</p>
          <code className="block break-all rounded-token bg-sunken px-4 py-3 text-sm text-copy">
            {sourcePath}
          </code>
        </header>

        <div>{children}</div>
      </div>
    </main>
  );
}
