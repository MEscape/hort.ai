import type { Ref } from 'react';

import { Card } from '@components/ui/card';

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
    <Card className="flex flex-col items-center gap-5 px-6 py-8 text-center sm:p-10">
      <StartIllustration kind={kind} className="h-40 w-48" />
      <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy">
        {copy.title}
      </h1>
      <p className="max-w-md text-lead text-copy-muted">{copy.body}</p>
    </Card>
  );
}
