import { WORLD_AREAS } from '@modules/world';

/** Retrieval bounds (performance.md): every list is capped. */
/** Islands one child's homework can cover: never more than the world has. */
export const HOMEWORK_AREA_IDS_MAX = WORLD_AREAS.length;
