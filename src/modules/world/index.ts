/**
 * Server-side public API of the world module: the islands a homework task can belong to, as plain
 * data for the pages that draw them. Which island a task opens is decided by the backend from a
 * validated classification (`resolveArea`), never by the AI's own words. The islands hold no
 * learning content of their own. The module has no translations: the pages pass translated labels.
 */
export {
  FALLBACK_AREA_ID,
  WORLD_AREAS,
  areasForSchoolSubject,
  resolveArea,
} from './application/contracts/world-constraints';
/** The island catalog and its delivered picture widths, for `scripts/world-assets.ts`. */
export { ISLAND_IMAGE_WIDTHS, islandCatalog } from './presentation/catalog/island-catalog';
export type {
  AreaId,
  SchoolSubject,
  Subject,
  WorldArea,
} from './application/contracts/world-constraints';
export { islandTopic, worldIsland, worldIslands } from './presentation/dto/island-dto';
export type { IslandArtDto, IslandDto, IslandTopic } from './presentation/dto/island-dto';
