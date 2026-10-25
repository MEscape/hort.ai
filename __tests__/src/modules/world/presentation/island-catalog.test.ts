import { describe, expect, it } from 'vitest';

import { WORLD_AREAS } from '@modules/world/domain/models/world-areas';
import {
  islandCatalog,
  islandImageKey,
  islandPicture,
} from '@modules/world/presentation/catalog/island-catalog';
import { toIslandDto, worldIslands } from '@modules/world/presentation/dto/island-dto';
import { islandCatalogSchema } from '@modules/world/presentation/schemas/island-catalog-schema';

const BASE = 'https://storage.test/public';

function firstIsland() {
  const [first] = islandCatalog.islands;
  if (first === undefined) {
    throw new Error('the catalog is empty');
  }
  return first;
}

function parseWith(change: (island: ReturnType<typeof firstIsland>) => unknown) {
  return islandCatalogSchema.safeParse({ version: 1, islands: [change(firstIsland())] });
}

describe('island catalog', () => {
  it('draws every world area as exactly one island, and nothing else', () => {
    const drawn = islandCatalog.islands.map((island) => island.areaId).sort();
    expect(drawn).toEqual(WORLD_AREAS.map((area) => area.id).sort());
  });

  it('gives every island at least two places to discover', () => {
    for (const island of islandCatalog.islands) {
      expect(island.locations.length, island.areaId).toBeGreaterThanOrEqual(2);
    }
  });

  it('rejects an island for an area that does not exist', () => {
    expect(parseWith((island) => ({ ...island, areaId: 'atlantis' })).success).toBe(false);
  });

  it('rejects a second island for the same area', () => {
    const island = firstIsland();
    expect(islandCatalogSchema.safeParse({ version: 1, islands: [island, island] }).success).toBe(
      false,
    );
  });

  it('rejects a place whose topic belongs to another area', () => {
    const result = parseWith((island) => ({
      ...island,
      locations: island.locations.map((location) => ({ ...location, topics: ['planets'] })),
    }));
    expect(result.success).toBe(false);
  });

  it('rejects a place outside the picture', () => {
    const result = parseWith((island) => ({
      ...island,
      locations: island.locations.map((location) => ({ ...location, x: 1.2 })),
    }));
    expect(result.success).toBe(false);
  });

  it('rejects two places with the same id on one island', () => {
    const result = parseWith((island) => ({
      ...island,
      locations: island.locations.map((location) => ({ ...location, id: 'gleich' })),
    }));
    expect(result.success).toBe(false);
  });

  it('requires exactly one base picture per island', () => {
    const result = parseWith((island) => ({
      ...island,
      assets: island.assets.map((asset) => ({ ...asset, category: 'decoration' })),
    }));
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(parseWith((island) => ({ ...island, extra: 1 })).success).toBe(false);
  });
});

describe('island pictures', () => {
  it('maps a picture to its storage key per width', () => {
    expect(islandImageKey('zahlenwald', 'island', 1024)).toBe('world/zahlenwald/island-1024.webp');
  });

  it('serves a ready picture in two widths, versioned against the browser cache', () => {
    const picture = islandPicture(BASE, 'zahlenwald', {
      id: 'island',
      status: 'ready',
      version: '2026-10-25a',
    });
    expect(picture).toEqual({
      src: `${BASE}/world/zahlenwald/island-1024.webp?v=2026-10-25a`,
      srcSet: `${BASE}/world/zahlenwald/island-512.webp?v=2026-10-25a 512w, ${BASE}/world/zahlenwald/island-1024.webp?v=2026-10-25a 1024w`,
    });
  });

  it('has no picture while it is only planned or no storage is configured', () => {
    const ready = { id: 'island', status: 'ready', version: '1' } as const;
    expect(islandPicture(BASE, 'zahlenwald', { ...ready, status: 'planned' })).toBeNull();
    expect(islandPicture(undefined, 'zahlenwald', ready)).toBeNull();
  });
});

describe('island dto', () => {
  it('uses the locale catalog for island names, landmarks and place sentences', () => {
    const islands = worldIslands(BASE, {
      zahlenwald: {
        name: 'Number Forest',
        landmark: 'Counting Tower',
        locations: {
          zaehlbruecke: {
            name: 'Counting Bridge',
            about: 'For counting and counting out objects.',
          },
        },
      },
    });
    const island = islands.find((candidate) => candidate.areaId === 'zahlenwald');
    expect(island?.name).toBe('Number Forest');
    expect(island?.landmarkName).toBe('Counting Tower');
    expect(island?.locations[0]?.name).toBe('Counting Bridge');
  });
  it('lists every area in the order of the world, with its name and places', () => {
    const islands = worldIslands(BASE);
    expect(islands.map((island) => island.areaId)).toEqual(WORLD_AREAS.map((area) => area.id));
    expect(islands.find((island) => island.areaId === 'maerchenwald')?.name).toBe('Märchenwald');
  });

  it('draws an area the catalog does not know yet instead of failing', () => {
    const area = WORLD_AREAS.find((candidate) => candidate.id === 'zahlenwald');
    if (area === undefined) {
      throw new Error('zahlenwald is missing');
    }
    const island = toIslandDto(area, undefined, BASE);
    expect(island).toMatchObject({ areaId: 'zahlenwald', name: 'Zahlenwald', picture: null });
    expect(island.locations).toEqual([]);
    expect(island.art.seed).toBe('zahlenwald');
  });
});
