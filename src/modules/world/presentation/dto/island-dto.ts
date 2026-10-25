import {
  WORLD_AREAS,
  discoveryOf,
  isAreaId,
  schoolSubjectOf,
} from '../../application/contracts/world-constraints';
import { islandCatalog, islandPicture } from '../catalog/island-catalog';

import type {
  AreaId,
  IslandDiscovery,
  SchoolSubject,
  Subject,
  WorldArea,
} from '../../application/contracts/world-constraints';
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
  /** From the child's own homework (`discoveryOf`); unknown when no record was read. */
  readonly discovery: IslandDiscovery;
  /** The child already did homework on this island; a record, never a reward. */
  readonly hadHomework: boolean;
}

/** The island (and optionally the place on it) a homework task was started from. */
export interface IslandTopic {
  readonly areaId: AreaId;
  readonly placeId: string | null;
  /** The school subject the help session is grounded in. */
  readonly subject: SchoolSubject;
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
    hadHomework: false,
  };
}

/** `homeworkAreaIds` are the islands of the child's own help sessions; `undefined` is no record. */
function discovered(
  island: IslandDto,
  homeworkAreaIds: ReadonlySet<string> | undefined,
): IslandDto {
  return {
    ...island,
    discovery: discoveryOf(island.areaId, homeworkAreaIds ?? null),
    hadHomework: homeworkAreaIds?.has(island.areaId) ?? false,
  };
}

/** Every island of the world, in the order of `WORLD_AREAS`. `baseUrl` is the public container. */
export function worldIslands(
  baseUrl: string | undefined,
  labels?: WorldLabels,
  homeworkAreaIds?: ReadonlySet<string>,
): readonly IslandDto[] {
  return WORLD_AREAS.map((area) =>
    discovered(
      localized(toIslandDto(area, ISLAND_BY_AREA.get(area.id), baseUrl), labels),
      homeworkAreaIds,
    ),
  );
}

/** One island, or `null` for an id that is not a world area. */
export function worldIsland(
  areaId: string,
  baseUrl: string | undefined,
  labels?: WorldLabels,
  homeworkAreaIds?: ReadonlySet<string>,
): IslandDto | null {
  const area = WORLD_AREAS.find((candidate) => candidate.id === areaId);
  return area === undefined
    ? null
    : discovered(
        localized(toIslandDto(area, ISLAND_BY_AREA.get(area.id), baseUrl), labels),
        homeworkAreaIds,
      );
}

/**
 * Validates an island and place from untrusted input (a link's query, an action's payload): the
 * island must be a world area and the place one of that island's own places, or there is no topic.
 */
export function islandTopic(
  areaId: string | undefined,
  placeId: string | undefined,
): IslandTopic | null {
  if (areaId === undefined || !isAreaId(areaId)) {
    return null;
  }
  const places = ISLAND_BY_AREA.get(areaId)?.locations ?? [];
  if (placeId !== undefined && !places.some((p) => p.id === placeId)) {
    return null;
  }
  return { areaId, placeId: placeId ?? null, subject: schoolSubjectOf(areaId) };
}
