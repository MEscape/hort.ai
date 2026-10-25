/**
 * The words the island catalog is written in. The drawn placeholder (`components/island-art.tsx`)
 * has a palette for every biome and a shape for every glyph, so adding one here means drawing it.
 */

/** The ground an island stands on. Drives the placeholder palette and the art brief. */
export const BIOMES = [
  'meadow',
  'forest',
  'autumn',
  'snow',
  'lake',
  'beach',
  'village',
  'workshop',
  'night',
  'garden',
  'canyon',
  'cave',
  'candy',
] as const;
export type Biome = (typeof BIOMES)[number];

/** A small, readable stand-in for a landmark or a place on the drawn placeholder. */
export const GLYPHS = [
  'tree',
  'pine',
  'house',
  'tower',
  'mountain',
  'pond',
  'windmill',
  'tent',
  'flowers',
  'rock',
  'boat',
  'dome',
  'stage',
  'bridge',
  'signpost',
  'cube',
] as const;
export type Glyph = (typeof GLYPHS)[number];

/**
 * What a picture of an island's package is. Only `island` (the base illustration) is drawn by the
 * app today; the others are reserved so a package can grow without a schema change.
 */
export const ASSET_CATEGORIES = [
  'island',
  'landmark',
  'environment',
  'topic',
  'location',
  'decoration',
  'expansion',
] as const;

/** `planned`: not generated yet, the app draws the placeholder. `ready`: uploaded, the app shows it. */
export const ASSET_STATUSES = ['planned', 'ready'] as const;
