import { expect, it, vi } from 'vitest';

import { SignedMaterialTextReader } from '@modules/teacher-material/infrastructure/storage/signed-material-text-reader';

import { world } from './world';

it('reads signed private UTF-8 bytes and refuses a stream beyond the cap', async () => {
  const w = world();
  const request = vi.fn(async () => new Response('abcd'));
  const reader = new SignedMaterialTextReader(w.deps.store, request);
  const location = { visibility: 'private' as const, key: 'classes/class-1/materials/material-1' };
  expect([...(await reader.read(location, 4))._unsafeUnwrap()]).toEqual([97, 98, 99, 100]);
  expect((await reader.read(location, 3)).isErr()).toBe(true);
  expect(request).toHaveBeenCalledWith(
    'https://storage.test/read',
    expect.objectContaining({ cache: 'no-store', redirect: 'error' }),
  );
});
