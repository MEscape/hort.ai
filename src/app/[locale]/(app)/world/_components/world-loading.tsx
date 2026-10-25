import { Skeleton } from '@components/ui/skeleton';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

/**
 * The screen-reader line every world placeholder carries; the shapes themselves are hidden. The
 * locale comes from the page: the fallback renders outside Suspense, where no request may be read.
 */
async function LoadingStatus({ locale }: { readonly locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'app' });
  return (
    <p role="status" className="sr-only">
      {t('loading')}
    </p>
  );
}

/** The map page while it loads: the back button, the title, the subject buttons and the sea. */
export function WorldMapLoading({ locale }: { readonly locale: Locale }) {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-3 px-4 pt-3 pb-safe sm:px-6"
    >
      <LoadingStatus locale={locale} />
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-8 w-1/2 md:h-10" />
      <div className="flex gap-2 overflow-hidden">
        {/* The home button and the first subjects; the rest scroll off on a phone anyway. */}
        {['home', 'first', 'second', 'third', 'fourth'].map((chip) => (
          <Skeleton key={chip} className="h-12 w-28 shrink-0" />
        ))}
      </div>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="min-h-80 flex-1 rounded-token-xl!" />
    </div>
  );
}

/** One island while it loads: the way back, its name, its picture and the card of places. */
export function IslandLoading({ locale }: { readonly locale: Locale }) {
  return (
    <div
      aria-busy="true"
      className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6"
    >
      <LoadingStatus locale={locale} />
      <Skeleton className="h-12 w-40" />
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <Skeleton className="mx-auto aspect-4/3 w-full max-w-3xl rounded-token-xl!" />
      <Skeleton className="measure mx-auto h-28 w-full rounded-token-xl!" />
    </div>
  );
}
