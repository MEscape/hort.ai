import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { ButtonPlayground } from './button-playground';
import { CardSpecimens } from './card-specimens';
import { FeedbackSpecimens } from './feedback-specimens';

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
        <CardSpecimens locale={locale} />
      </section>

      <section aria-labelledby="feedback-title" className="space-y-5">
        <div className="max-w-2xl">
          <h2 id="feedback-title" className="font-heading text-3xl text-copy">
            {t('designSystem.feedback.title')}
          </h2>
          <p className="mt-3 text-copy-muted">{t('designSystem.feedback.description')}</p>
        </div>
        <FeedbackSpecimens locale={locale} />
      </section>
    </div>
  );
}
