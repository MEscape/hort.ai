import { describe, expect, it } from 'vitest';

import {
  FALLBACK_AREA_ID,
  WORLD_AREAS,
  isAreaId,
  resolveArea,
} from '@modules/world/domain/models/world-areas';

describe('world areas', () => {
  it('gives every area a unique, storage-safe id', () => {
    const ids = WORLD_AREAS.map((area) => area.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9-]{1,40}$/);
    }
  });

  it('keeps every grade range inside primary school and in order', () => {
    for (const { grades } of WORLD_AREAS) {
      expect(grades[0]).toBeGreaterThanOrEqual(1);
      expect(grades[1]).toBeLessThanOrEqual(4);
      expect(grades[0]).toBeLessThanOrEqual(grades[1]);
    }
  });

  it('has exactly one fallback area, the one the resolver falls back to', () => {
    const fallbacks = WORLD_AREAS.filter((area) => 'fallback' in area && area.fallback);
    expect(fallbacks.map((area) => area.id)).toEqual([FALLBACK_AREA_ID]);
  });

  it('accepts a known id with enough confidence', () => {
    expect(resolveArea('zahlenwald', 0.9).id).toBe('zahlenwald');
    expect(resolveArea('zahlenwald', 0.7).id).toBe('zahlenwald');
  });

  it('falls back when the confidence is too low', () => {
    expect(resolveArea('zahlenwald', 0.69).id).toBe(FALLBACK_AREA_ID);
    expect(resolveArea('zahlenwald', 0.8, 0.85).id).toBe(FALLBACK_AREA_ID);
  });

  it('falls back for an unknown, missing or prototype-named id', () => {
    for (const id of ['atlantis', '', undefined, 'constructor', '__proto__', 'ZAHLENWALD']) {
      expect(resolveArea(id, 1).id).toBe(FALLBACK_AREA_ID);
    }
  });

  it('falls back for a confidence that is not a number between 0 and 1', () => {
    expect(resolveArea('zahlenwald', Number.NaN).id).toBe(FALLBACK_AREA_ID);
  });

  it('narrows only real area ids', () => {
    expect(isAreaId('maerchenwald')).toBe(true);
    expect(isAreaId('toString')).toBe(false);
  });
});
