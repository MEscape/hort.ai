'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { materialCommands } from '../../composition';
import { materialUploadSchema } from '../schemas/material-upload-schema';
import { parseTeacherMaterialInput } from '../schemas/parse-teacher-material-input';

/** @keep Teacher upload client integration; credentials returned once, never cached or logged. */
export async function beginMaterialUploadAction(input: unknown): Promise<ActionResult<{ readonly materialId: string; readonly upload: { readonly kind: "http-put"; readonly url: string; readonly headers: Readonly<Record<string, string>>; readonly expiresAt: string } }>> {
  const result = await parseTeacherMaterialInput(materialUploadSchema, input).asyncAndThen(value => materialCommands.beginMaterialUpload.execute(value));
  return toActionResult(result.map(value => ({ materialId: value.materialId, upload: { ...value.upload, expiresAt: value.upload.expiresAt.toISOString() } })));
}
