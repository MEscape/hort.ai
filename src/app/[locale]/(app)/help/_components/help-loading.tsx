import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Skeleton } from '@components/ui/skeleton';

import { getTranslations } from '@i18n/server';

/**
 * The help screen while it loads, in the shapes it will have: the task card, the companion's first
 * line and the card to ask for a hint or answer, so nothing jumps when the conversation arrives.
 */
export async function HelpLoading() {
  const t = await getTranslations('app');
  return (
    <div aria-busy="true" className="mx-auto max-w-3xl space-y-5">
      <p role="status" className="sr-only">
        {t('loading')}
      </p>
      <Card>
        <CardHeader className="items-start">
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-12 w-4/5" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="gap-5">
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-28 w-full rounded-token-lg!" />
        </CardContent>
      </Card>
    </div>
  );
}
