'use client';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

const HOTLINE = '116 111';
const POLICE = '110';
const EMERGENCY = '112';

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
        {/* @ui-plain a Telephone contact links, not app navigation; no ContentLink primitive exists. */}
        <a href="tel:116111" className="font-heading text-3xl underline">
          {HOTLINE}
        </a>
        <p>{t('distress.hours')}</p>
        <p>{t('distress.emergency')}</p>
        <p className="flex gap-6">
          {/* @ui-plain a Telephone contact links, not app navigation; no ContentLink primitive exists. */}
          <a href="tel:110" className="font-semibold underline">
            {POLICE}
          </a>
          {/* @ui-plain a Telephone contact links, not app navigation; no ContentLink primitive exists. */}
          <a href="tel:112" className="font-semibold underline">
            {EMERGENCY}
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
