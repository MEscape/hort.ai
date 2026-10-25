import { describe, expect, it } from 'vitest';

import {
  ISLAND_VIEWBOX,
  freeSceneryPoints,
  islandOutline,
  trailPath,
} from '@modules/world/presentation/art/island-geometry';

const NUMBERS = /-?\d+(?:\.\d+)?/g;

function coordinates(path: string): number[] {
  return (path.match(NUMBERS) ?? []).map(Number);
}

describe('island outline', () => {
  it('draws the same island for the same area every time', () => {
    expect(islandOutline('zahlenwald')).toEqual(islandOutline('zahlenwald'));
  });

  it('gives different areas different outlines', () => {
    const shapes = new Set(
      ['zahlenwald', 'maerchenwald', 'federsee', 'himmelsturm'].map(
        (seed) => islandOutline(seed).top,
      ),
    );
    expect(shapes.size).toBe(4);
  });

  it('keeps the whole island inside the picture', () => {
    for (const seed of ['zahlenwald', 'a', 'ueberraschungsinsel', 'x'.repeat(40)]) {
      const outline = islandOutline(seed);
      for (const path of Object.values(outline)) {
        const values = coordinates(path);
        const xs = values.filter((_, index) => index % 2 === 0);
        const ys = values.filter((_, index) => index % 2 === 1);
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...xs)).toBeLessThanOrEqual(ISLAND_VIEWBOX.width);
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...ys)).toBeLessThanOrEqual(ISLAND_VIEWBOX.height);
      }
    }
  });

  it('keeps scenery away from the places', () => {
    const place = { x: 92, y: 128 };
    const free = freeSceneryPoints([place]);
    expect(free.length).toBeGreaterThan(0);
    for (const spot of free) {
      expect(Math.hypot(spot.x - place.x, spot.y - place.y)).toBeGreaterThan(40);
    }
  });

  it('bends a trail between two points', () => {
    expect(trailPath({ x: 100, y: 150 }, { x: 200, y: 100 })).toMatch(/^M100 150Q[\d. -]+200 100$/);
  });
});
