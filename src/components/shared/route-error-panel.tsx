'use client';

import { Lumi } from '@components/brand/lumi';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

export interface RouteErrorPanelProps {
  /** The `reset` function Next.js passes to an `error.tsx`. */
  readonly onRetry: () => void;
}

/**
 * What every `error.tsx` shows: a gentle "something went wrong", Lumi looking a little puzzled,
 * and one way forward. It never prints the error's own message (that is for logs, not people).
 */
export function RouteErrorPanel({ onRetry }: RouteErrorPanelProps) {
  const t = useTranslations('app');

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Lumi mood="oops" className="size-24" />
        <h1 className="text-3xl">{t('routeError.title')}</h1>
      </CardHeader>
      <CardContent>
        <p className="measure text-center text-lead text-copy-muted">
          {t('routeError.description')}
        </p>
        <Button size="lg" onClick={onRetry}>
          {t('routeError.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
