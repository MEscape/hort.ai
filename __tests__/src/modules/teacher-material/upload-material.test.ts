import { expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { UploadMaterial } from '@modules/teacher-material/application/commands/upload-material';

import { infrastructureError } from '@lib/errors';
import { errAsync } from '@lib/result';

import { parent } from '../auth/fakes';

import { world } from './world';

const UPLOAD_KEY = 'uploads/classes/class-1/materials/material-1';
const PUBLISHED_KEY = 'classes/class-1/materials/material-1';

it('stages the file on the server, then checks and publishes it', async () => {
  const w = world();
  const result = await new UploadMaterial(w.deps).execute(w.input, w.bytes);
  expect(result._unsafeUnwrap()).toEqual({ materialId: 'material-1' });
  expect(w.rows[0]?.status).toBe('PROCESSED');
  expect(w.rows[0]?.sizeBytes).toBe(w.bytes.byteLength);
  expect([...w.written.keys()]).toEqual([UPLOAD_KEY, PUBLISHED_KEY]);
  expect(w.written.get(PUBLISHED_KEY)).toEqual(w.bytes);
  expect(w.deletedKeys).toEqual([UPLOAD_KEY]);
  expect(w.sections.get('material-1')).toHaveLength(1);
});

it('refuses another teacher’s class before anything is stored', async () => {
  const w = world();
  w.as(parent({ id: toActorId('teacher-2'), roles: ['teacher'] }));
  expect((await new UploadMaterial(w.deps).execute(w.input, w.bytes)).isErr()).toBe(true);
  expect(w.rows).toHaveLength(0);
  expect(w.written.size).toBe(0);
});

it('fails the material when the staging write fails', async () => {
  const w = world();
  w.deps.writer.write = () => errAsync(infrastructureError('teacher_material.write_failed', ''));
  expect((await new UploadMaterial(w.deps).execute(w.input, w.bytes)).isErr()).toBe(true);
  expect(w.rows[0]?.status).toBe('FAILED');
});

it('fails the material when the stored bytes are not text', async () => {
  const w = world();
  const binary = new Uint8Array([0, 1, 2, 3]);
  w.size = binary.length;
  expect(
    (
      await new UploadMaterial(w.deps).execute({ ...w.input, sizeBytes: binary.length }, binary)
    ).isErr(),
  ).toBe(true);
  expect(w.rows[0]?.status).toBe('FAILED');
  expect(w.written.has(PUBLISHED_KEY)).toBe(false);
});
