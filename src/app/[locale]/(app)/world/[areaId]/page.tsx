import { Suspense } from 'react';

import { notFound } from 'next/navigation';

import { requireSignedIn } from '@modules/auth';
import { requireOnboarded } from '@modules/learner';
import { worldIsland } from '@modules/world';
import { IslandView, worldRoutes } from '@modules/world/client';

import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link, requireLocale } from '@i18n';

import { getMessages, getTranslations } from '@i18n/server';

import { serverEnv } from '@lib/config/server';
import { buildPrivateMetadata } from '@lib/seo';

import { loadHomeworkAreaIds } from '@/app/_lib/homework-area-ids';

import { IslandLoading } from '../_components/world-loading';

interface IslandPageParams {
  readonly params: Promise<{ locale: string; areaId: string }>;
}

/** The task entry that starts a help session; without `?child=` it uses the onboarded child. */
const START_HREF = '/start';

export async function generateMetadata({ params }: IslandPageParams) {
  const { locale, areaId } = await params;
  const t = await getTranslations({ locale: requireLocale(locale), namespace: 'app' });
  return buildPrivateMetadata(worldIsland(areaId, undefined)?.name ?? t('world.map.metadataTitle'));
}

async function Island({ params }: IslandPageParams) {
  const { areaId } = await params;
  await requireSignedIn(worldRoutes.island(areaId));
  const child = await requireOnboarded();
  const { app } = await getMessages();
  // The segment is untrusted input: an id that is not a world area is a missing page.
  const island =
    worldIsland(
      areaId,
      serverEnv.STORAGE_PUBLIC_BASE_URL,
      app.world.areas,
      await loadHomeworkAreaIds(child.id),
    ) ?? notFound();
  const t = await getTranslations('app');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Button asChild variant="ghost" className="self-start">
        <Link href={worldRoutes.map()}>
          <ArrowLeft aria-hidden="true" />
          {t('world.island.backToMap')}
        </Link>
      </Button>
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-display">{island.name}</h1>
        <p className="text-copy-muted">
          {t('world.island.landmark', { name: island.landmarkName })}
        </p>
      </header>
      <IslandView
        island={island}
        startHref={START_HREF}
        labels={{
          places: t('world.island.placesLabel', { island: island.name }),
          pickPlace: t('world.island.pickPlace'),
          noPlaces: t('world.island.noPlaces'),
          start: t('world.island.start'),
          inMist: t('world.island.inMist'),
        }}
      />
    </main>
  );
}

/** Reads the segment (inside Suspense) and shows the island's placeholder in its language. */
async function IslandWithLoading({ params }: IslandPageParams) {
  const locale = requireLocale((await params).locale);
  return (
    <Suspense fallback={<IslandLoading locale={locale} />}>
      <Island params={params} />
    </Suspense>
  );
}

/**
 * With cache components and partial prefetching the island segment is read inside Suspense, so the
 * page's shell prerenders; an id that is not a world area then renders the not-found panel.
 */
export default function IslandPage({ params }: IslandPageParams) {
  return (
    <div data-world="lagoon" className="min-h-dvh bg-world">
      <Suspense fallback={null}>
        <IslandWithLoading params={params} />
      </Suspense>
    </div>
  );
}
