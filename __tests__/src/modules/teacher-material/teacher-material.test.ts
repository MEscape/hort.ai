import { expect, it } from 'vitest';

import { BeginMaterialUpload } from '@modules/teacher-material/application/commands/begin-material-upload';

import { world } from './world';

it('persists an owned material before signing a private upload keyed by trusted IDs', async () => {
  const w = world();
  const result = await new BeginMaterialUpload(w.deps).execute(w.input);
  expect(result.isOk()).toBe(true);
  expect(w.rows).toHaveLength(1);
  expect(w.signedAfterRow).toBe(true);
  expect(w.location).toEqual({ visibility: 'private', key: 'classes/class-1/materials/material-1' });
});
