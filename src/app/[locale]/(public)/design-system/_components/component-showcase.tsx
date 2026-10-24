import { FeedbackPanel } from '@components/shared/feedback-panel';
import { Card } from '@components/ui/card';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ButtonPlayground } from './button-playground';

interface ComponentShowcaseProps {
  readonly locale: Locale;
}

export async function ComponentShowcase({ locale }: ComponentShowcaseProps) {
  const t = await getTranslations({ locale, namespace: 'app' });

  return (
    <div className="space-y-14">
      <section aria-labelledby="buttons-title" className="space-y-5">
        <div className="max-w-2xl">
          <h2 id="buttons-title" className="font-heading text-3xl text-copy">
            {t('designSystem.buttons.title')}
          </h2>
          <p className="mt-3 text-copy-muted">{t('designSystem.buttons.description')}</p>
        </div>
        <ButtonPlayground />
      </section>

      <section aria-labelledby="cards-title" className="space-y-5">
        <div className="max-w-2xl">
          <h2 id="cards-title" className="font-heading text-3xl text-copy">
            {t('designSystem.cards.title')}
          </h2>
          <p className="mt-3 text-copy-muted">{t('designSystem.cards.description')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col gap-4">
            <div aria-hidden="true" className="relative h-16 w-16 rounded-token-lg bg-primary">
              <span className="absolute inset-3 rounded-full border-4 border-primary-foreground" />
            </div>
            <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.continue')}</h3>
            <p className="text-base text-copy-muted">
              {t('designSystem.cards.continueDescription')}
            </p>
          </Card>
          <Card tone="highlight" className="flex flex-col gap-4">
            <div
              aria-hidden="true"
              className="flex h-16 w-16 items-center justify-center rounded-token-lg bg-accent"
            >
              <span className="h-8 w-8 rotate-45 rounded-token-sm bg-accent-foreground" />
            </div>
            <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.new')}</h3>
            <p className="text-base text-copy-muted">{t('designSystem.cards.newDescription')}</p>
          </Card>
          <Card tone="sunken" className="flex flex-col gap-4">
            <div aria-hidden="true" className="relative h-16 w-16 rounded-token-lg bg-secondary">
              <span className="absolute inset-3 rounded-token-sm border-4 border-secondary-foreground" />
              <span className="absolute inset-5 rounded-full bg-secondary-foreground" />
            </div>
            <h3 className="font-heading text-xl text-copy">{t('designSystem.cards.explore')}</h3>
            <p className="text-base text-copy-muted">
              {t('designSystem.cards.exploreDescription')}
            </p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="feedback-title" className="space-y-5">
        <div className="max-w-2xl">
          <h2 id="feedback-title" className="font-heading text-3xl text-copy">
            {t('designSystem.feedback.title')}
          </h2>
          <p className="mt-3 text-copy-muted">{t('designSystem.feedback.description')}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <FeedbackPanel tone="success" title={t('designSystem.feedback.successTitle')}>
            {t('designSystem.feedback.successBody')}
          </FeedbackPanel>
          <FeedbackPanel tone="nudge" title={t('designSystem.feedback.nudgeTitle')}>
            {t('designSystem.feedback.nudgeBody')}
          </FeedbackPanel>
          <FeedbackPanel tone="hint" title={t('designSystem.feedback.hintTitle')}>
            {t('designSystem.feedback.hintBody')}
          </FeedbackPanel>
        </div>
      </section>
    </div>
  );
}
