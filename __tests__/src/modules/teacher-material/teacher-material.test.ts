import { expect, it } from 'vitest';

import { CompleteMaterialUpload } from '@modules/teacher-material/application/commands/complete-material-upload';
import { BeginMaterialUpload } from '@modules/teacher-material/application/commands/begin-material-upload';

import { DeleteMaterial } from '@modules/teacher-material/application/commands/delete-material';
import { GetMaterialReadUrl } from '@modules/teacher-material/application/queries/get-material-read-url';
import { ListMaterials } from '@modules/teacher-material/application/queries/list-materials';
import { toActorId } from '@modules/auth/domain/models/ids';

import { parent } from '../auth/fakes';
import { world } from './world';

it('persists an owned material before signing a private upload keyed by trusted IDs', async () => {
  const w = world();
  const result = await new BeginMaterialUpload(w.deps).execute(w.input);
  expect(result.isOk()).toBe(true);
  expect(w.rows).toHaveLength(1);
  expect(w.signedAfterRow).toBe(true);
  expect(w.location).toEqual({
    visibility: 'private',
    key: 'classes/class-1/materials/material-1',
  });
});

it('validates stored bytes and publishes extracted statements, idempotently', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  const complete = new CompleteMaterialUpload(w.deps);
  expect((await complete.execute('material-1')).isOk()).toBe(true);
  expect(w.rows[0]?.status).toBe('PROCESSED');
  expect(w.sections.get('material-1')?.[0]?.text).toContain('Zahlen');
  expect((await complete.execute('material-1')).isOk()).toBe(true);
});

it('refuses upload, list, read, complete and delete for another teacher', async () => {
  const w = world();
  const begin = new BeginMaterialUpload(w.deps);
  await begin.execute(w.input);
  w.as(parent({ id: toActorId('teacher-2'), roles: ['teacher'] }));
  for (const result of [
    await begin.execute(w.input),
    await new ListMaterials(w.deps).execute('class-1'),
    await new GetMaterialReadUrl(w.deps).execute('material-1'),
    await new CompleteMaterialUpload(w.deps).execute('material-1'),
    await new DeleteMaterial(w.deps).execute('material-1'),
  ])
    expect(result.isErr()).toBe(true);
  expect(w.rows[0]?.status).toBe('UPLOADED');
  expect(w.deleted).toBe(false);
});

it('deletes sections before file cleanup and cannot reprocess deleted material', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  await new CompleteMaterialUpload(w.deps).execute('material-1');
  expect((await new ListMaterials(w.deps).execute('class-1'))._unsafeUnwrap()).toHaveLength(1);
  expect((await new GetMaterialReadUrl(w.deps).execute('material-1')).isOk()).toBe(true);
  expect((await new DeleteMaterial(w.deps).execute('material-1')).isOk()).toBe(true);
  expect(w.sections.size).toBe(0);
  expect(w.deleted).toBe(true);
  expect((await new ListMaterials(w.deps).execute('class-1'))._unsafeUnwrap()).toEqual([]);
  expect((await new GetMaterialReadUrl(w.deps).execute('material-1')).isErr()).toBe(true);
  expect((await new CompleteMaterialUpload(w.deps).execute('material-1')).isErr()).toBe(true);
});

it('rejects wrong declared types and oversize uploads before signing', async () => {
  for (const change of [
    { contentType: 'application/pdf' },
    { contentType: 'image/png' },
    { sizeBytes: 10_485_761 },
  ]) {
    const w = world();
    expect((await new BeginMaterialUpload(w.deps).execute({ ...w.input, ...change })).isErr()).toBe(
      true,
    );
    expect(w.rows).toEqual([]);
  }
});

it('fails and removes objects with forged MIME, binary signatures, or a mismatching stored size', async () => {
  for (const change of [
    { mime: 'application/pdf' },
    { size: 10_485_761 },
    { bytes: new TextEncoder().encode('%PDF- fake file') },
    { bytes: new Uint8Array([0, 1, 2]) },
  ]) {
    const w = world();
    await new BeginMaterialUpload(w.deps).execute(w.input);
    Object.assign(w, change);
    const result = await new CompleteMaterialUpload(w.deps).execute('material-1');
    expect(result.isErr()).toBe(true);
    expect(w.rows[0]?.status).toBe('FAILED');
    expect(w.sections.size).toBe(0);
    expect(w.deleted).toBe(true);
  }
});

it('accepts valid UTF-8 when the sniff boundary splits a multibyte character', async () => {
  const w = world();
  w.bytes = new TextEncoder().encode('a'.repeat(511) + 'ä und Zahlen ordnen.');
  w.size = w.bytes.length;
  await new BeginMaterialUpload(w.deps).execute({ ...w.input, sizeBytes: w.size });
  expect((await new CompleteMaterialUpload(w.deps).execute('material-1')).isOk()).toBe(true);
});
