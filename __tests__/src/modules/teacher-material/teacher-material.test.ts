import { expect, it } from 'vitest';

import { toActorId } from '@modules/auth/domain/models/ids';
import { BeginMaterialUpload } from '@modules/teacher-material/application/commands/begin-material-upload';
import { CompleteMaterialUpload } from '@modules/teacher-material/application/commands/complete-material-upload';
import { DeleteMaterial } from '@modules/teacher-material/application/commands/delete-material';
import { GetMaterialReadUrl } from '@modules/teacher-material/application/queries/get-material-read-url';
import { ListMaterials } from '@modules/teacher-material/application/queries/list-materials';

import { infrastructureError, validationError } from '@lib/errors';
import { ResultAsync, errAsync, okAsync } from '@lib/result';

import { createBrokenRateLimiter } from '../../support/rate-limiting';
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
    key: 'uploads/classes/class-1/materials/material-1',
  });
  expect(w.rows[0]?.objectKey).toBe('classes/class-1/materials/material-1');
});

const UPLOAD_KEY = 'uploads/classes/class-1/materials/material-1';
const PUBLISHED_KEY = 'classes/class-1/materials/material-1';

it('publishes the checked bytes under a key no upload names and removes the upload', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  const checked = w.bytes;
  w.deps.textReader.read = () => {
    // The upload URL is still valid: the teacher replaces the object right after it was read.
    const read = w.bytes;
    w.bytes = new TextEncoder().encode('<script>alert(1)</script>');
    return okAsync(read);
  };

  expect((await new CompleteMaterialUpload(w.deps).execute('material-1')).isOk()).toBe(true);

  expect([...w.written.keys()]).toEqual([PUBLISHED_KEY]);
  expect(w.written.get(PUBLISHED_KEY)).toEqual(checked);
  expect(w.deletedKeys).toEqual([UPLOAD_KEY]);
  expect((await new GetMaterialReadUrl(w.deps).execute('material-1')).isOk()).toBe(true);
  expect(w.readKeys).toEqual([PUBLISHED_KEY]);
});

it('fails the material and removes both objects when the checked copy cannot be written', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  w.deps.writer.write = () => errAsync(infrastructureError('teacher_material.write_failed', ''));

  const result = await new CompleteMaterialUpload(w.deps).execute('material-1');

  expect(result._unsafeUnwrapErr().code).toBe('teacher_material.write_failed');
  expect(w.rows[0]?.status).toBe('FAILED');
  expect(w.sections.size).toBe(0);
  expect(w.deletedKeys).toEqual([UPLOAD_KEY, PUBLISHED_KEY]);
  expect((await new GetMaterialReadUrl(w.deps).execute('material-1')).isErr()).toBe(true);
});

it('removes the published copy and a leftover upload when the material is deleted', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  await new CompleteMaterialUpload(w.deps).execute('material-1');
  w.deletedKeys.length = 0;

  expect((await new DeleteMaterial(w.deps).execute('material-1')).isOk()).toBe(true);
  expect(w.deletedKeys).toEqual([PUBLISHED_KEY, UPLOAD_KEY]);
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
  ]) {
    expect(result.isErr()).toBe(true);
  }
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

it('does not remove a processed object when another completion fails concurrently', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  w.deps.textReader.read = () => {
    const row = w.rows[0];
    if (row) {
      row.status = 'PROCESSED';
    }
    return errAsync(validationError('test.invalid', 'Invalid', {}));
  };
  await new CompleteMaterialUpload(w.deps).execute('material-1');
  expect(w.rows[0]?.status).toBe('PROCESSED');
  expect(w.deleted).toBe(false);
});

it('never overwrites a published copy when two completions read different upload versions', async () => {
  const w = world();
  await new BeginMaterialUpload(w.deps).execute(w.input);
  const first = new TextEncoder().encode('- Zahlen bis 1000 vergleichen und ordnen.');
  const second = new TextEncoder().encode('- Zahlen bis 9999 vergleichen und ordnen.');
  expect(second.length).toBe(first.length);
  // Both completions read the upload before either writes; the teacher replaced it in between.
  const versions = [first, second];
  let release: () => void = () => undefined;
  const bothRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  const read = w.deps.textReader.read;
  w.deps.textReader.read = (location, max) => {
    if (location.key !== UPLOAD_KEY) {
      return read(location, max);
    }
    const version = versions[reads++] ?? first;
    if (reads === 2) {
      release();
    }
    return okAsync(undefined)
      .andThen(() => ResultAsync.fromSafePromise(bothRead))
      .map(() => version);
  };

  const complete = new CompleteMaterialUpload(w.deps);
  const results = await Promise.all([
    complete.execute('material-1'),
    complete.execute('material-1'),
  ]);

  expect(results.filter((r) => r.isOk()).length).toBeGreaterThanOrEqual(1);
  expect(w.rows[0]?.status).toBe('PROCESSED');
  const served = new TextDecoder().decode(w.written.get(PUBLISHED_KEY));
  expect(served).toBe(new TextDecoder().decode(first));
  // The stored statements belong to the served bytes, whichever completion won the CAS.
  expect(w.sections.get('material-1')?.map((s) => s.text)).toEqual([served.replace(/^- /, '')]);
});

it('bounds upload attempts per teacher and refuses a broken limiter', async () => {
  const w = world();
  const begin = new BeginMaterialUpload(w.deps);
  for (let count = 0; count < 30; count++) {
    expect((await begin.execute(w.input)).isOk()).toBe(true);
  }
  expect((await begin.execute(w.input))._unsafeUnwrapErr().kind).toBe('rate_limited');
  const broken = world();
  expect(
    (
      await new BeginMaterialUpload({
        ...broken.deps,
        rateLimiter: createBrokenRateLimiter(),
      }).execute(broken.input)
    )._unsafeUnwrapErr().kind,
  ).toBe('infrastructure');
  expect(broken.rows).toEqual([]);
});

it('accepts valid UTF-8 when the sniff boundary splits a multibyte character', async () => {
  const w = world();
  w.bytes = new TextEncoder().encode(`${'a'.repeat(511)}ä und Zahlen ordnen.`);
  w.size = w.bytes.length;
  await new BeginMaterialUpload(w.deps).execute({ ...w.input, sizeBytes: w.size });
  expect((await new CompleteMaterialUpload(w.deps).execute('material-1')).isOk()).toBe(true);
});
