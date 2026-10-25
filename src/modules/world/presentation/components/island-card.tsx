import type { FocusEvent } from 'react';

import { Link } from '@i18n';

import { worldRoutes } from '../routes';

import { IslandPicture } from './island-picture';

import type { IslandDto } from '../dto/island-dto';

export interface IslandCardProps {
  readonly island: IslandDto;
  readonly onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
}

/** One island on the map: the picture and its name, as one link into the island. */
export function IslandCard({ island, onFocus }: IslandCardProps) {
  return (
    <Link
      href={worldRoutes.island(island.areaId)}
      onFocus={onFocus}
      className="group flex flex-col items-center gap-1 rounded-token-lg p-1 transition-transform duration-300 ease-soft hover:-translate-y-1 focus-visible:-translate-y-1"
    >
      <IslandPicture
        art={island.art}
        picture={island.picture}
        sizes="15rem"
        discovery={island.discovery}
      />
      <span className="relative -mt-3 max-w-full rounded-token-lg bg-surface px-3 py-2 text-center font-heading text-base leading-snug font-semibold hyphens-auto break-words text-copy shadow-soft transition-colors group-hover:bg-highlight">
        {island.name}
      </span>
    </Link>
  );
}
