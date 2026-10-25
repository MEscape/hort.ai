'use server';

import { ResultAsync, toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { MATERIAL_QUERY_LIMITS } from '../../application/contracts/teacher-material-constraints';
import { materialCommands } from '../../composition';
import {
  materialFormContentType,
  materialFormUploadSchema,
} from '../schemas/material-upload-schema';
import { parseTeacherMaterialInput } from '../schemas/parse-teacher-material-input';

function titleOf(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').trim();
  return (base === '' ? file.name : base).slice(0, MATERIAL_QUERY_LIMITS.title);
}

/** @keep Class page upload: `classroomId` and `file` from a form; the file never leaves the server. */
export async function uploadMaterialAction(
  input: unknown,
): Promise<ActionResult<{ readonly materialId: string }>> {
  const formData = input instanceof FormData ? input : new FormData();
  const file = formData.get('file');
  const result = await parseTeacherMaterialInput(materialFormUploadSchema, {
    classroomId: formData.get('classroomId'),
    title: file instanceof File ? titleOf(file) : '',
    contentType: file instanceof File ? materialFormContentType(file) : '',
    sizeBytes: file instanceof File ? file.size : 0,
  }).asyncAndThen((value) =>
    // Without a file the title is empty and the schema has refused already.
    ResultAsync.fromSafePromise(
      file instanceof File ? file.arrayBuffer() : Promise.resolve(new ArrayBuffer(0)),
    ).andThen((buffer) => materialCommands.uploadMaterial.execute(value, new Uint8Array(buffer))),
  );
  return toActionResult(result);
}
