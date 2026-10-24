import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

interface FoundationsShowcaseProps {
  readonly locale: Locale;
}

export async function FoundationsShowcase({ locale }: FoundationsShowcaseProps) {
  const t = await getTranslations({ locale, namespace: 'app' });
  const colors = [
    {
      label: t('designSystem.colors.primary'),
      token: '--hortai-color-primary',
      className: 'bg-primary',
    },
    {
      label: t('designSystem.colors.secondary'),
      token: '--hortai-color-secondary',
      className: 'bg-secondary',
    },
    {
      label: t('designSystem.colors.accent'),
      token: '--hortai-color-accent',
      className: 'bg-accent',
    },
    {
      label: t('designSystem.colors.bloom'),
      token: '--hortai-color-bloom',
      className: 'bg-bloom',
    },
    {
      label: t('designSystem.colors.canvas'),
      token: '--hortai-color-background',
      className: 'bg-canvas',
    },
  ];

  return (
    <section aria-labelledby="colors-title" className="space-y-6">
      <div className="max-w-2xl">
        <h2 id="colors-title" className="font-heading text-3xl text-copy">
          {t('designSystem.colors.title')}
        </h2>
        <p className="mt-3 text-copy-muted">{t('designSystem.colors.description')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {colors.map(({ label, token, className }) => (
          <div
            key={token}
            className="rounded-token-xl border border-border bg-surface p-3 shadow-soft"
          >
            <div className={cn('h-28 rounded-token-lg border border-border', className)} />
            <p className="mt-3 font-heading font-semibold text-copy">{label}</p>
            <code className="block break-all text-xs text-copy-muted">{token}</code>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-token-xl border border-border bg-surface p-7 shadow-soft">
          <h3 className="font-heading text-xl text-primary-copy">
            {t('designSystem.typography.title')}
          </h3>
          <p className="mt-2 text-sm text-copy-muted">
            {t('designSystem.typography.headingCaption')}
          </p>
          <p className="mt-6 font-heading text-3xl leading-tight text-copy">
            {t('designSystem.typography.heading')}
          </p>
        </div>
        <div className="rounded-token-xl border border-border bg-surface p-7 shadow-soft">
          <p className="font-heading text-xl text-primary-copy">
            {t('designSystem.typography.bodyCaption')}
          </p>
          <p className="measure mt-6 text-lead text-copy">{t('designSystem.typography.body')}</p>
        </div>
      </div>
    </section>
  );
}
