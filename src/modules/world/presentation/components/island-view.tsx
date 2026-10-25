'use client';

import { useState } from 'react';

import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { ArrowRight } from '@components/ui/icons';

import { Link } from '@i18n';

import { buildQueryString } from '@lib/utils';

import { IslandPicture } from './island-picture';
import { LocationMarker } from './location-marker';

import type { IslandDto } from '../dto/island-dto';

export interface IslandViewProps {
  readonly island: IslandDto;
  /** Where a homework task is started (the app shell's task entry); the island and place are added. */
  readonly startHref: string;
  readonly labels: IslandViewLabels;
}

/** Translated by the page. */
export interface IslandViewLabels {
  /** Names the group of places, e.g. "Places on Zahlenwald". */
  readonly places: string;
  readonly pickPlace: string;
  readonly noPlaces: string;
  readonly start: string;
  /** Said instead of the places on an island still in the mist. */
  readonly inMist: string;
}

/**
 * One island, big, with its places as pins. Tapping a place says which homework belongs there;
 * the way on is always the child's own homework, never an exercise of Hort.ai's (the islands hold
 * no learning content of their own, `docs/product/vision.md`).
 */
export function IslandView({ island, startHref, labels }: IslandViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = island.locations.find((location) => location.id === selectedId);

  // In the mist: no places and no way to start here; homework classified here clears it.
  if (island.discovery === 'unrevealed') {
    return (
      <div className="flex flex-col gap-6">
        <IslandPicture
          art={island.art}
          picture={island.picture}
          sizes="(min-width: 48rem) 48rem, 100vw"
          isPriority
          discovery={island.discovery}
          className="mx-auto max-w-3xl"
        />
        <Card className="measure mx-auto w-full">
          <CardContent>
            <p className="text-copy-muted">{labels.inMist}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label={labels.places} className="relative mx-auto w-full max-w-3xl">
        <IslandPicture
          art={island.art}
          picture={island.picture}
          sizes="(min-width: 48rem) 48rem, 100vw"
          isPriority
          discovery={island.discovery}
        />
        {island.locations.map((location) => (
          <LocationMarker
            key={location.id}
            location={location}
            isSelected={location.id === selectedId}
            onSelect={() => {
              setSelectedId(location.id);
            }}
          />
        ))}
      </div>
      <Card className="measure mx-auto w-full">
        <CardContent className="flex flex-col gap-4">
          <div aria-live="polite" className="flex flex-col gap-1">
            {selected === undefined ? (
              <p className="text-copy-muted">
                {island.locations.length > 0 ? labels.pickPlace : labels.noPlaces}
              </p>
            ) : (
              <>
                <h2 className="text-2xl">{selected.name}</h2>
                <p>{selected.about}</p>
              </>
            )}
          </div>
          <Button asChild size="lg">
            <Link
              href={`${startHref}${buildQueryString({ area: island.areaId, place: selected?.id })}`}
            >
              {labels.start}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
