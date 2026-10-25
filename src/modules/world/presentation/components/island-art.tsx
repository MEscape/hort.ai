import { cn } from '@lib/utils';

import {
  ISLAND_VIEWBOX,
  LANDMARK_POINT,
  freeSceneryPoints,
  islandOutline,
  trailPath,
} from '../art/island-geometry';

import { IslandGlyph } from './island-glyph';

import type { Biome, Glyph } from '../catalog/island-vocabulary';
import type { IslandArtDto } from '../dto/island-dto';

export interface IslandArtProps {
  readonly art: IslandArtDto;
  readonly className?: string | undefined;
}

const { width, height } = ISLAND_VIEWBOX;

/** A few still points of light over the night biome, so it reads as dusk without being dark. */
const NIGHT_LIGHTS = [
  [92, 34, 2.4],
  [142, 18, 1.6],
  [268, 26, 2.2],
  [318, 46, 1.6],
] as const;

/** The small scenery that tells the biomes apart at thumbnail size. */
const BIOME_SCENERY: Readonly<Record<Biome, Glyph | null>> = {
  meadow: 'flowers',
  forest: 'tree',
  autumn: 'tree',
  snow: 'pine',
  lake: 'flowers',
  beach: 'rock',
  village: 'tree',
  workshop: null,
  night: null,
  garden: 'tree',
  canyon: 'rock',
  cave: 'rock',
  candy: 'flowers',
};

/**
 * The drawn placeholder of an island: the same canvas, camera and light as the generated pictures
 * (`docs/architecture/world.md`), built from the island's seed, biome, landmark and places. Shown
 * until a picture is uploaded and whenever it fails to load. Decorative: the island's name is
 * always written next to it by the interface, never into the art.
 */
export function IslandArt({ art, className }: IslandArtProps) {
  const outline = islandOutline(art.seed);
  const places = art.places
    .map((place) => ({ ...place, x: place.x * width, y: place.y * height }))
    .sort((a, b) => a.y - b.y);
  const scenery = BIOME_SCENERY[art.biome];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      data-biome={art.biome}
      aria-hidden="true"
      focusable="false"
      className={cn('block h-auto w-full', className)}
    >
      <ellipse cx="200" cy="290" rx="62" ry="6" className="fill-copy/10" />
      <path d={outline.underside} className="fill-island-rock" />
      <path d={outline.shade} className="fill-island-rock-shade" />
      <path
        d={outline.strata}
        className="stroke-island-rock-shade"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d={outline.side} className="fill-island-side" />
      <path d={outline.top} className="fill-island-rim" />
      <path d={outline.inner} className="fill-island-top" />
      <ellipse cx="160" cy="108" rx="48" ry="13" className="fill-island-wall/20" />
      {art.biome === 'lake' && (
        <>
          <ellipse cx="200" cy="136" rx="62" ry="20" className="fill-island-water" />
          <ellipse cx="184" cy="131" rx="24" ry="5" className="fill-island-water-light" />
        </>
      )}
      {art.biome === 'night' &&
        NIGHT_LIGHTS.map(([cx, cy, r]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className="fill-island-snow" />
        ))}
      {places.map((place) => (
        <path
          key={`trail-${place.x}-${place.y}`}
          d={trailPath(place, LANDMARK_POINT)}
          className="stroke-island-path"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ))}
      {scenery !== null &&
        freeSceneryPoints(places).map((spot) => (
          <IslandGlyph
            key={`scenery-${spot.x}`}
            glyph={scenery}
            x={spot.x}
            y={spot.y}
            scale={0.7}
          />
        ))}
      <IslandGlyph glyph={art.landmark} x={LANDMARK_POINT.x} y={LANDMARK_POINT.y} scale={1.8} />
      {places.map((place) => (
        <IslandGlyph key={`${place.x}-${place.y}`} glyph={place.glyph} x={place.x} y={place.y} />
      ))}
    </svg>
  );
}
