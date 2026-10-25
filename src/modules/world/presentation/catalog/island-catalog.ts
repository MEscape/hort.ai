import { islandCatalogSchema } from '../schemas/island-catalog-schema';

import catalogJson from './islands.json';

import type { IslandAsset, IslandCatalog } from '../schemas/island-catalog-schema';

/**
 * The validated island catalog. Parsed once at import: a broken `islands.json` (an unknown area, a
 * topic of another area, a place outside the picture) fails the build and the tests instead of
 * reaching a child's screen.
 */
export const islandCatalog: IslandCatalog = islandCatalogSchema.parse(catalogJson);

/** Every island picture lives in the public container below `world/<areaId>/`. */
const WORLD_STORAGE_PREFIX = 'world';

/**
 * The delivered widths of a picture (4:3, transparent WebP), cut from the 2048 × 1536 master by
 * `npm run world:assets`. The map shows islands at most about 500 CSS pixels wide.
 */
export const ISLAND_IMAGE_WIDTHS = [512, 1024] as const;
type IslandImageWidth = (typeof ISLAND_IMAGE_WIDTHS)[number];

/** The storage key of one width of an island picture, relative to the public container. */
export function islandImageKey(areaId: string, assetId: string, width: IslandImageWidth): string {
  return `${WORLD_STORAGE_PREFIX}/${areaId}/${assetId}-${width}.webp`;
}

export interface IslandPictureSource {
  readonly src: string;
  readonly srcSet: string;
}

/**
 * The addresses of an uploaded picture below `baseUrl` (no trailing slash), versioned against the
 * browser cache. `null` while the picture is only planned or no storage is configured: the app
 * then draws the placeholder island.
 */
export function islandPicture(
  baseUrl: string | undefined,
  areaId: string,
  asset: Pick<IslandAsset, 'id' | 'status' | 'version'>,
): IslandPictureSource | null {
  if (baseUrl === undefined || asset.status !== 'ready') {
    return null;
  }
  const url = (width: IslandImageWidth) =>
    `${baseUrl}/${islandImageKey(areaId, asset.id, width)}?v=${asset.version}`;
  return {
    src: url(1024),
    srcSet: ISLAND_IMAGE_WIDTHS.map((width) => `${url(width)} ${width}w`).join(', '),
  };
}
