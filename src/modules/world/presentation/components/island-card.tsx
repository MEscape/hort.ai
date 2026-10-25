import { useId, type FocusEvent } from 'react';

import { Check } from '@components/ui/icons';

import { Link } from '@i18n';

import { worldRoutes } from '../routes';

import { IslandPicture } from './island-picture';

import type { IslandDto } from '../dto/island-dto';

export interface IslandCardProps {
  readonly island: IslandDto;
  readonly onFocus?: (event: FocusEvent<HTMLAnchorElement>) => void;
  /** Read after the island's name: still in the mist, or homework was done here. */
  readonly status?: string | undefined;
}

/**
 * One island on the map: the picture and its name, as one link into the island. An island still in
 * the mist is only a picture: it opens once the child's own homework was classified there.
 */
export function IslandCard({ island, onFocus, status }: IslandCardProps) {
  const statusId = useId();
  if (island.discovery === 'unrevealed') {
    return (
      <div
        role="img"
        aria-label={island.name}
        aria-describedby={status === undefined ? undefined : statusId}
        className="flex flex-col items-center gap-1 p-1"
      >
        <IslandPicture
          art={island.art}
          picture={island.picture}
          sizes="15rem"
          discovery={island.discovery}
        />
        <span className="relative -mt-3 max-w-full rounded-token-lg bg-surface/70 px-3 py-2 text-center font-heading text-base leading-snug font-semibold hyphens-auto break-words text-copy-muted">
          {island.name}
        </span>
        {status !== undefined && (
          <span id={statusId} className="sr-only">
            {status}
          </span>
        )}
      </div>
    );
  }
  return (
    <>
      <Link
        href={worldRoutes.island(island.areaId)}
        onFocus={onFocus}
        aria-describedby={status === undefined ? undefined : statusId}
        className="group flex flex-col items-center gap-1 rounded-token-lg p-1 transition-transform duration-300 ease-soft hover:-translate-y-1 focus-visible:-translate-y-1"
      >
        <IslandPicture
          art={island.art}
          picture={island.picture}
          sizes="15rem"
          discovery={island.discovery}
        />
        <span className="relative -mt-3 max-w-full rounded-token-lg bg-surface px-3 py-2 text-center font-heading text-base leading-snug font-semibold hyphens-auto break-words text-copy shadow-soft transition-colors group-hover:bg-highlight">
          {island.hadHomework && (
            <Check
              aria-hidden="true"
              className="mr-1 inline size-4 align-[-0.125em] text-primary-copy"
            />
          )}
          {island.name}
        </span>
      </Link>
      {status !== undefined && (
        <span id={statusId} className="sr-only">
          {status}
        </span>
      )}
    </>
  );
}
