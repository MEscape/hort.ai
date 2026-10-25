'use client';

import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

/**
 * A teacher without an active class: assignments need one first. The page hands in the classroom
 * module's creation form, so this module does not reach into another module's interface.
 */
export function FirstClassroomPanel({ children }: { readonly children: ReactNode }) {
  const t = useTranslations('assignments');

  return (
    <Card>
      <CardHeader className="items-start text-left">
        <h1 className="font-heading text-3xl text-copy">{t('page.noClassTitle')}</h1>
        <p className="text-copy-muted">{t('page.noClassBody')}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
