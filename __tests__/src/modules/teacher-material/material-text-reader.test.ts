import { expect, it, vi } from 'vitest';

import { SignedMaterialObjectWriter } from '@modules/teacher-material/infrastructure/storage/signed-material-object-writer';
import { SignedMaterialTextReader } from '@modules/teacher-material/infrastructure/storage/signed-material-text-reader';

import { world } from './world';

it('writes the checked bytes through one signed PUT and reports a refused write', async () => {
  const w = world();
  const request = vi.fn(async () => new Response(null, { status: 201 }));
  const writer = new SignedMaterialObjectWriter(w.deps.store, request);
  const location = { visibility: 'private' as const, key: 'classes/class-1/materials/material-1' };
  const bytes = new TextEncoder().encode('Zahlen');

  expect((await writer.write(location, bytes, 'text/plain')).isOk()).toBe(true);
  expect(w.location).toEqual(location);
  expect(request).toHaveBeenCalledWith(
    'https://storage.test/upload',
    expect.objectContaining({
      method: 'PUT',
      body: bytes,
      redirect: 'error',
      headers: expect.objectContaining({ 'If-None-Match': '*' }),
    }),
  );

  request.mockResolvedValueOnce(new Response(null, { status: 409 }));
  expect((await writer.write(location, bytes, 'text/plain'))._unsafeUnwrapErr().code).toBe(
    'teacher_material.already_written',
  );

  request.mockResolvedValueOnce(new Response(null, { status: 403 }));
  expect((await writer.write(location, bytes, 'text/plain'))._unsafeUnwrapErr().code).toBe(
    'teacher_material.write_failed',
  );
});

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
