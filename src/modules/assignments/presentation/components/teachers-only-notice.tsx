'use client';

import { Hort } from '@components/brand/hort';
import { Card, CardContent } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

/** Shown to a signed-in parent: the use case refused them, so nothing of any class is loaded. */
export function TeachersOnlyNotice() {
  const t = useTranslations('assignments');

  return (
    <Card>
      <CardContent className="items-center gap-3 py-12 text-center">
        <Hort mood="think" className="size-20" />
        <h1 className="font-heading text-3xl text-copy">{t('page.teachersOnlyTitle')}</h1>
        <p className="max-w-md text-copy-muted">{t('page.teachersOnlyBody')}</p>
      </CardContent>
    </Card>
  );
}
