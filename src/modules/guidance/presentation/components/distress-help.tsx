'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

/** Fixed help, not homework or AI text. No input is echoed and nobody is notified (#90). */
export function DistressHelp() {
  const t = useTranslations('guidance');
  return (
    <Card role="status" aria-live="polite">
      <CardHeader>
        <h2 className="font-heading text-2xl">{t('distress.title')}</h2>
      </CardHeader>
      <CardContent className="space-y-4 text-lead">
        <p>{t('distress.brave')}</p>
        <p>{t('distress.trustedAdult')}</p>
        <p>{t('distress.hotline')}</p>
        <a href="tel:116111" className="font-heading text-3xl underline">
          116 111
        </a>
        <p>{t('distress.hours')}</p>
        <p>{t('distress.emergency')}</p>
        <p className="flex gap-6">
          <a href="tel:110" className="font-semibold underline">
            110
          </a>
          <a href="tel:112" className="font-semibold underline">
            112
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
