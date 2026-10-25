import { Suspense } from 'react';

import { requireSignedIn } from '@modules/auth';
import { learnerRoutes, requireOnboarded } from '@modules/learner';
import { worldIslands } from '@modules/world';
import type { Subject } from '@modules/world';
import { WorldMap, worldRoutes } from '@modules/world/client';

import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link, requireLocale } from '@i18n';

import { getMessages, getTranslations } from '@i18n/server';

import { serverEnv } from '@lib/config/server';
import { buildPrivateMetadata } from '@lib/seo';

import { loadHomeworkAreaIds } from '@/app/_lib/homework-area-ids';

import { WorldMapLoading } from './_components/world-loading';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'app' });
  return buildPrivateMetadata(t('world.map.metadataTitle'));
}

async function IslandWorld() {
  await requireSignedIn(worldRoutes.map());
  const child = await requireOnboarded();
  const t = await getTranslations('app');
  // Pictures come from the public container of this environment; without one, every island is drawn.
  const { app } = await getMessages();
  const islands = worldIslands(
    serverEnv.STORAGE_PUBLIC_BASE_URL,
    app.world.areas,
    await loadHomeworkAreaIds(child.id),
  );
  const subjects = {
    deutsch: t('world.subjects.deutsch'),
    mathe: t('world.subjects.mathe'),
    'sachunterricht-natur': t('world.subjects.natur'),
    'sachunterricht-gesellschaft': t('world.subjects.gesellschaft'),
    'sprachen-kunst': t('world.subjects.sprachenKunst'),
    zusammenleben: t('world.subjects.zusammenleben'),
    lernen: t('world.subjects.lernen'),
  } as const satisfies Record<Subject, string>;
  return (
    <main className="mx-auto flex h-dvh w-full max-w-6xl flex-col gap-3 px-4 pt-3 pb-safe sm:px-6">
      <Button asChild variant="ghost" className="self-start">
        <Link href={learnerRoutes.home()}>
          <ArrowLeft aria-hidden="true" />
          {t('world.map.backHome')}
        </Link>
      </Button>
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold md:text-4xl">{t('world.map.title')}</h1>
      </header>
      <WorldMap
        islands={islands}
        subjects={subjects}
        labels={{
          title: t('world.explore.title'),
          hint: t('world.explore.hint'),
          jump: t('world.explore.jump'),
          home: t('world.explore.home'),
          homeworkHere: t('world.explore.homeworkHere'),
          inMist: t('world.explore.inMist'),
        }}
      />
    </main>
  );
}

export default async function WorldPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  return (
    <div data-world="lagoon" className="min-h-dvh bg-world">
      <Suspense fallback={<WorldMapLoading locale={locale} />}>
        <IslandWorld />
      </Suspense>
    </div>
  );
}
