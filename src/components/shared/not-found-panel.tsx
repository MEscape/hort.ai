import { Lumi } from '@components/brand/lumi';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader } from '@components/ui/card';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

export interface NotFoundPanelProps {
  /** Where "back to home" leads: the caller owns its routes, shared code names none. */
  readonly homeHref: string;
}

/** What every `not-found.tsx` shows: a lost Lumi and the way back. Works as a Server Component. */
export function NotFoundPanel({ homeHref }: NotFoundPanelProps) {
  const t = useTranslations('app');

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <Lumi mood="think" className="size-24" />
        <h1 className="text-3xl">{t('notFound.title')}</h1>
      </CardHeader>
      <CardContent>
        <p className="measure text-center text-lead text-copy-muted">{t('notFound.description')}</p>
        <Button asChild size="lg">
          <Link href={homeHref}>{t('notFound.backToHome')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
