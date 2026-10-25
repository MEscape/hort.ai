'use client';

import { IslandPicture, WORLD_HOME, worldPosition, worldRoutes } from '@modules/world/client';

import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';
import { useAppFormatters } from '@i18n/formatters/client';

import { cn } from '@lib/utils';

import { HOME_CARD_CLASSES } from './home-card-body';

import type { WorldPreviewIsland } from './home-types';

interface WorldCardProps {
  readonly childName: string;
  readonly islands: readonly WorldPreviewIsland[];
  readonly isGuided: boolean;
}

const isHome = (areaId: string) => {
  const { x, y } = worldPosition(areaId);
  return x === WORLD_HOME.x && y === WORLD_HOME.y;
};

/**
 * A small live look at the child's world: the start and the islands of the child's own homework
 * are clear, the rest lie in a light mist. It is a place to wander through, never a path to
 * complete or a reward: nothing here is locked, counted or timed. The fog is a pale veil over the island, and the sentence for a screen reader says it.
 * The islands stand in a row in the same left-to-right order as on the map, the starting island in
 * the middle and a little bigger; a row has its own height, so it never runs into the title.
 */
export function WorldCard({ childName, islands, isGuided }: WorldCardProps) {
  const t = useTranslations('app');
  const owner = useAppFormatters().possessive(childName);
  const row = [...islands].sort((a, b) => worldPosition(a.areaId).x - worldPosition(b.areaId).x);
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        HOME_CARD_CLASSES,
        'overflow-hidden flex-col items-stretch gap-1 bg-world border-border',
      )}
    >
      <Link
        data-guide-target="world"
        href={worldRoutes.map()}
        data-guided={isGuided}
        aria-label={t('home.world.preview', { owner })}
      >
        <span className="font-heading text-2xl leading-tight font-semibold text-copy">
          {t('home.world.title', { owner })}
        </span>
        <span aria-hidden="true" className="flex items-end justify-center -space-x-4 py-1">
          {row.map((island) => (
            <span
              key={island.areaId}
              className={cn(
                'block shrink-0',
                isHome(island.areaId) ? 'relative z-10 w-32 translate-y-2 md:w-36' : 'w-24 md:w-28',
              )}
            >
              <IslandPicture
                art={island.art}
                picture={island.picture}
                discovery={island.discovery}
                sizes="9rem"
              />
            </span>
          ))}
        </span>
        <span className="text-base text-secondary-copy">{t('home.world.explore')} →</span>
      </Link>
    </Button>
  );
}
