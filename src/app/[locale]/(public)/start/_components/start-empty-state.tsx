import type { Ref } from 'react';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { StartIllustration } from './start-illustration';

interface StartEmptyStateProps {
  readonly kind: 'school' | 'continue';
  readonly headingRef: Ref<HTMLHeadingElement>;
}

export function StartEmptyState({ kind, headingRef }: StartEmptyStateProps) {
  const t = useTranslations('app');
  const copy =
    kind === 'school'
      ? { title: t('start.school.title'), body: t('start.school.body') }
      : { title: t('start.resume.title'), body: t('start.resume.body') };

  return (
    <Card>
      <CardContent className="items-center gap-5 py-8 text-center sm:py-10">
        <StartIllustration kind={kind} className="h-40 w-48" />
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy">
          {copy.title}
        </h1>
        <p className="max-w-md text-lead text-copy-muted">{copy.body}</p>
        {kind === 'continue' && (
          <Button asChild size="lg">
            <Link href="/help">{t('start.resume.continue')}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
