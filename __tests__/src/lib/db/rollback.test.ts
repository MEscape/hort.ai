import { describe, expect, it } from 'vitest';

import { rollbackWith, rollbackable } from '@lib/db';

describe('rollbackable', () => {
  it('reports the value of a transaction that completed', async () => {
    expect(await rollbackable(() => Promise.resolve(42))).toEqual({ kind: 'done', value: 42 });
  });

  it('turns rollbackWith into rolled-back with its refusal', async () => {
    const refusal = { code: 'slot.taken' };

    const outcome = await rollbackable(() => {
      rollbackWith(refusal);
      return Promise.resolve('unreachable');
    });

    expect(outcome).toEqual({ kind: 'rolled-back', refusal });
  });

  it('turns rollbackWith from inside an async body into rolled-back', async () => {
    const outcome = await rollbackable(async () => {
      await Promise.resolve();
      return rollbackWith('late refusal');
    });

    expect(outcome).toEqual({ kind: 'rolled-back', refusal: 'late refusal' });
  });

  it('lets any other failure pass through unchanged', async () => {
    const failure = new Error('driver down');

    await expect(rollbackable(() => Promise.reject(failure))).rejects.toBe(failure);
  });
});

describe('rollbackWith', () => {
  it('throws, so the surrounding transaction rolls back', () => {
    expect(() => rollbackWith('no')).toThrow('The transaction was rolled back on purpose.');
  });
});
