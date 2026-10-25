import { beforeEach, describe, expect, it, vi } from 'vitest';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { loadHomeworkAreaIds } from '@/app/_lib/homework-area-ids';

const wiring = vi.hoisted(() => ({ execute: vi.fn(), warn: vi.fn() }));
vi.mock('@modules/guidance', () => ({
  getHelpSessionQueries: () => ({ getHomeworkAreaIds: { execute: wiring.execute } }),
}));
vi.mock('@lib/logger', () => ({ logger: { warn: wiring.warn } }));

describe('loadHomeworkAreaIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives the islands of the child as a set for the map', async () => {
    wiring.execute.mockReturnValue(okAsync(['zahlenwald', 'malmuehle']));

    const ids = await loadHomeworkAreaIds('child-1');

    expect(wiring.execute).toHaveBeenCalledWith({ childProfileId: 'child-1' });
    expect(ids).toEqual(new Set(['zahlenwald', 'malmuehle']));
  });

  it('answers no record when the islands cannot be read, so no island is hidden in mist', async () => {
    wiring.execute.mockReturnValue(errAsync(infrastructureError('guidance.store_failed', 'down')));

    expect(await loadHomeworkAreaIds('child-1')).toBeUndefined();
    expect(wiring.warn).toHaveBeenCalledWith('world.homework_areas_unavailable', {
      code: 'guidance.store_failed',
    });
  });
});
