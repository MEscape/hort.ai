import { Card } from '@components/ui/card';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

interface CardSpecimensProps {
  readonly locale: Locale;
}

export async function CardSpecimens({ locale }: CardSpecimensProps) {
  const t = await getTranslations({ locale, namespace: 'app' });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="gap-4 p-5">
        <div aria-hidden="true" className="relative h-16 w-16 rounded-token-lg bg-primary">
          <span className="absolute inset-3 rounded-full border-4 border-primary-foreground" />
        </div>
        <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.continue')}</h3>
        <p className="text-base text-copy-muted">{t('designSystem.cards.continueDescription')}</p>
      </Card>
      <Card tone="highlight" className="gap-4 p-5">
        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-token-lg bg-accent"
        >
          <span className="h-8 w-8 rotate-45 rounded-token-sm bg-accent-foreground" />
        </div>
        <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.new')}</h3>
        <p className="text-base text-copy-muted">{t('designSystem.cards.newDescription')}</p>
      </Card>
      <Card tone="sunken" className="gap-4 p-5">
        <div aria-hidden="true" className="relative h-16 w-16 rounded-token-lg bg-secondary">
          <span className="absolute inset-3 rounded-token-sm border-4 border-secondary-foreground" />
          <span className="absolute inset-5 rounded-full bg-secondary-foreground" />
        </div>
        <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.explore')}</h3>
        <p className="text-base text-copy-muted">{t('designSystem.cards.exploreDescription')}</p>
      </Card>
    </div>
  );
}
