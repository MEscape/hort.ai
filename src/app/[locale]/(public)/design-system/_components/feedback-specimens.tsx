import { FeedbackPanel } from '@components/shared/feedback-panel';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

interface FeedbackSpecimensProps {
  readonly locale: Locale;
}

export async function FeedbackSpecimens({ locale }: FeedbackSpecimensProps) {
  const t = await getTranslations({ locale, namespace: 'app' });

  return (
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
  );
}
