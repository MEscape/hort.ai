/** Browser-safe part of the world module: its routes and the drawn islands. No catalog or storage imports. */
export { worldRoutes } from './presentation/routes';
export { IslandArt } from './presentation/components/island-art';
export { IslandPicture } from './presentation/components/island-picture';
export { worldPosition, WORLD_HOME } from './presentation/dto/world-layout-dto';
export { IslandView } from './presentation/components/island-view';
export { WorldMap } from './presentation/components/world-map';
export type { IslandArtDto, IslandDto } from './presentation/dto/island-dto';
