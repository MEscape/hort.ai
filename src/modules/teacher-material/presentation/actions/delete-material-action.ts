'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { materialCommands } from '../../composition';
import { materialIdSchema } from '../schemas/material-upload-schema';
import { parseTeacherMaterialInput } from '../schemas/parse-teacher-material-input';

/** @keep Teacher upload client integration; credentials returned once, never cached or logged. */
export async function deleteMaterialAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseTeacherMaterialInput(materialIdSchema, input).asyncAndThen((value) =>
    materialCommands.deleteMaterial.execute(value.id),
  );
  return toActionResult(result);
}
