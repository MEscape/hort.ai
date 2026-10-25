import { z } from 'zod';

import { WORLD_AREAS, isAreaId } from '../../application/contracts/world-constraints';
import { ASSET_CATEGORIES, ASSET_STATUSES, BIOMES, GLYPHS } from '../catalog/island-vocabulary';

/**
 * How every world area is drawn: one floating island, its signature landmark, the places a child
 * can discover on it and the pictures of its asset package. The catalog (`catalog/islands.json`)
 * is presentation only and keyed by the area id; names, topics and grades stay in `WORLD_AREAS`.
 * Location names and texts are German because the child reads them.
 */

/** Lower-case, no umlauts or spaces: part of storage keys and addresses. */
const SLUG = /^[a-z][a-z0-9-]{1,40}$/;

const slug = z.string().regex(SLUG, { error: 'Must be lower-case letters, digits or "-".' });
const label = z.string().trim().min(1).max(40);
/** A position on the island picture, as a fraction of its width or height. */
const fraction = z.number().min(0).max(1);

const locationSchema = z
  .object({
    id: slug,
    name: label,
    /** One short sentence for the child: which homework belongs here. */
    about: z.string().trim().min(1).max(90),
    /** Topics of the owning area this place stands for. */
    topics: z.array(z.string().min(1)).min(1),
    glyph: z.enum(GLYPHS),
    x: fraction,
    y: fraction,
  })
  .strict();

const assetSchema = z
  .object({
    /** Unique within the island; the asset's stable id is `<areaId>/<id>`. */
    id: slug,
    category: z.enum(ASSET_CATEGORIES),
    status: z.enum(ASSET_STATUSES),
    /** Appended as `?v=`; change it whenever the picture is uploaded again under the same key. */
    version: z.string().regex(/^[a-z0-9.-]{1,20}$/),
    /** What to generate, in English, on top of the shared style prompt (`STYLE_PROMPT` in `scripts/lib/world-assets.ts`). */
    brief: z.string().trim().min(40).max(1200),
  })
  .strict();

const islandSchema = z
  .object({
    areaId: z.string().refine(isAreaId, { error: 'Not an id of WORLD_AREAS.' }),
    biome: z.enum(BIOMES),
    landmark: z.object({ name: label, glyph: z.enum(GLYPHS) }).strict(),
    locations: z.array(locationSchema).min(1).max(6),
    assets: z.array(assetSchema).min(1),
  })
  .strict();

const TOPICS_BY_AREA: ReadonlyMap<string, readonly string[]> = new Map(
  WORLD_AREAS.map((area) => [area.id, area.topics]),
);

type Island = z.infer<typeof islandSchema>;
type Issue = (path: ReadonlyArray<string | number>, message: string) => void;

function checkIsland(island: Island, at: number, issue: Issue): void {
  const topics = TOPICS_BY_AREA.get(island.areaId) ?? [];
  const locationIds = new Set<string>();
  island.locations.forEach((location, index) => {
    if (locationIds.has(location.id)) {
      issue(['islands', at, 'locations', index, 'id'], `Duplicate place id "${location.id}".`);
    }
    locationIds.add(location.id);
    for (const topic of location.topics.filter((candidate) => !topics.includes(candidate))) {
      issue(
        ['islands', at, 'locations', index, 'topics'],
        `"${topic}" is not a topic of the area.`,
      );
    }
  });
  const assetIds = island.assets.map((asset) => asset.id);
  if (new Set(assetIds).size !== assetIds.length) {
    issue(['islands', at, 'assets'], 'Duplicate asset id.');
  }
  if (island.assets.filter((asset) => asset.category === 'island').length !== 1) {
    issue(['islands', at, 'assets'], 'An island needs exactly one asset of category "island".');
  }
}

export const islandCatalogSchema = z
  .object({
    version: z.literal(1),
    islands: z.array(islandSchema).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const issue: Issue = (path, message) => {
      ctx.addIssue({ code: 'custom', path: [...path], message });
    };
    const seen = new Set<string>();
    catalog.islands.forEach((island, at) => {
      if (seen.has(island.areaId)) {
        issue(['islands', at, 'areaId'], `Second island for "${island.areaId}".`);
      }
      seen.add(island.areaId);
      checkIsland(island, at, issue);
    });
  });

export type IslandCatalog = z.infer<typeof islandCatalogSchema>;
export type IslandEntry = IslandCatalog['islands'][number];
export type IslandAsset = IslandEntry['assets'][number];
