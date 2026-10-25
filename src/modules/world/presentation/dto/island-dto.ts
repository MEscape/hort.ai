import { WORLD_AREAS } from '../../application/contracts/world-constraints';
import { islandCatalog, islandPicture } from '../catalog/island-catalog';

import type { Subject, WorldArea } from '../../application/contracts/world-constraints';
import type { IslandPictureSource } from '../catalog/island-catalog';
import type { Biome, Glyph } from '../catalog/island-vocabulary';
import type { IslandEntry } from '../schemas/island-catalog-schema';

/** What the drawn placeholder needs: the same seed always gives the same outline. */
export interface IslandArtDto {
  readonly seed: string;
  readonly biome: Biome;
  readonly landmark: Glyph;
  readonly places: ReadonlyArray<{ readonly glyph: Glyph; readonly x: number; readonly y: number }>;
}

export interface IslandLocationDto {
  readonly id: string;
  readonly name: string;
  readonly about: string;
  readonly glyph: Glyph;
  readonly x: number;
  readonly y: number;
}

export interface IslandDto {
  readonly areaId: string;
  readonly name: string;
  readonly subject: Subject;
  readonly landmarkName: string;
  readonly art: IslandArtDto;
  readonly locations: readonly IslandLocationDto[];
  /** The uploaded illustration, or `null`: then the placeholder is drawn. */
  readonly picture: IslandPictureSource | null;
  /** No persistence exists yet. Unknown must never be reported as a saved reveal. */
  readonly discovery: 'unknown' | 'revealed' | 'unrevealed';
}

/** The ground of an area the catalog does not know yet (a new entry of `WORLD_AREAS`). */
const SUBJECT_BIOME = {
  deutsch: 'meadow',
  mathe: 'forest',
  'sachunterricht-natur': 'meadow',
  'sachunterricht-gesellschaft': 'village',
  'sprachen-kunst': 'beach',
  zusammenleben: 'village',
  lernen: 'candy',
} as const satisfies Record<Subject, Biome>;

const ISLAND_BY_AREA: ReadonlyMap<string, IslandEntry> = new Map(
  islandCatalog.islands.map((island) => [island.areaId, island]),
);

interface IslandLabels {
  readonly name: string;
  readonly landmark: string;
  readonly locations: Readonly<Record<string, { readonly name: string; readonly about: string }>>;
}
type WorldLabels = Readonly<Record<string, IslandLabels>>;

function localized(island: IslandDto, labels: WorldLabels | undefined): IslandDto {
  const text = labels?.[island.areaId];
  if (!text) {
    return island;
  }
  return {
    ...island,
    name: text.name,
    landmarkName: text.landmark,
    locations: island.locations.map((place) => ({ ...place, ...text.locations[place.id] })),
  };
}

/**
 * One area as the map draws it. An area without a catalog entry still gets an island (the
 * subject's ground, no places yet), so a new entry of `WORLD_AREAS` never breaks the map; the
 * catalog test makes the missing entry fail CI.
 */
export function toIslandDto(
  area: WorldArea,
  island: IslandEntry | undefined,
  baseUrl: string | undefined,
): IslandDto {
  const locations = island?.locations ?? [];
  const base = island?.assets.find((asset) => asset.category === 'island');
  return {
    areaId: area.id,
    name: area.name,
    subject: area.subject,
    landmarkName: island?.landmark.name ?? area.name,
    art: {
      seed: area.id,
      biome: island?.biome ?? SUBJECT_BIOME[area.subject],
      landmark: island?.landmark.glyph ?? 'tower',
      places: locations.map(({ glyph, x, y }) => ({ glyph, x, y })),
    },
    locations: locations.map(({ id, name, about, glyph, x, y }) => ({
      id,
      name,
      about,
      glyph,
      x,
      y,
    })),
    picture: base === undefined ? null : islandPicture(baseUrl?.replace(/\/$/, ''), area.id, base),
    discovery: 'unknown',
  };
}

/** Every island of the world, in the order of `WORLD_AREAS`. `baseUrl` is the public container. */
export function worldIslands(
  baseUrl: string | undefined,
  labels?: WorldLabels,
): readonly IslandDto[] {
  return WORLD_AREAS.map((area) =>
    localized(toIslandDto(area, ISLAND_BY_AREA.get(area.id), baseUrl), labels),
  );
}

/** One island, or `null` for an id that is not a world area. */
export function worldIsland(
  areaId: string,
  baseUrl: string | undefined,
  labels?: WorldLabels,
): IslandDto | null {
  const area = WORLD_AREAS.find((candidate) => candidate.id === areaId);
  return area === undefined
    ? null
    : localized(toIslandDto(area, ISLAND_BY_AREA.get(area.id), baseUrl), labels);
}
