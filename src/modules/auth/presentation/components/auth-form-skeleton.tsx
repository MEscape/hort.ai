'use client';

import { Card, CardContent } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';

import { useTranslations } from '@i18n/client';

/** Route fallbacks use the provided client catalog; they must not read request headers. */
export function AuthFormSkeleton() {
  const t = useTranslations('app');

  return (
    <Card role="status" aria-busy="true">
      <span className="sr-only">{t('loading')}</span>
      <CardContent className="gap-5 pt-8 sm:pt-10">
        <Skeleton className="mx-auto size-24 rounded-full" />
        <Skeleton className="mx-auto h-10 w-3/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
    </Card>
  );
}
