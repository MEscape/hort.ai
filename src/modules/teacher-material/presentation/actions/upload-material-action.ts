'use server';

import { ResultAsync, toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { MATERIAL_QUERY_LIMITS } from '../../application/contracts/teacher-material-constraints';
import { materialCommands } from '../../composition';
import { materialFormUploadSchema } from '../schemas/material-upload-schema';
import { parseTeacherMaterialInput } from '../schemas/parse-teacher-material-input';

/** Some systems send no MIME type for a `.txt` file; the server still checks every byte. */
function contentTypeOf(file: File): string {
  return file.type === '' && /\.txt$/i.test(file.name) ? 'text/plain' : file.type;
}

function titleOf(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').trim();
  return (base === '' ? file.name : base).slice(0, MATERIAL_QUERY_LIMITS.title);
}

/** @keep Class page upload: `classroomId` and `file` from a form; the file never leaves the server. */
export async function uploadMaterialAction(
  formData: FormData,
): Promise<ActionResult<{ readonly materialId: string }>> {
  const file = formData.get('file');
  const result = await parseTeacherMaterialInput(materialFormUploadSchema, {
    classroomId: formData.get('classroomId'),
    title: file instanceof File ? titleOf(file) : '',
    contentType: file instanceof File ? contentTypeOf(file) : '',
    sizeBytes: file instanceof File ? file.size : 0,
  }).asyncAndThen((value) =>
    // Without a file the title is empty and the schema has refused already.
    ResultAsync.fromSafePromise(
      file instanceof File ? file.arrayBuffer() : Promise.resolve(new ArrayBuffer(0)),
    ).andThen((buffer) => materialCommands.uploadMaterial.execute(value, new Uint8Array(buffer))),
  );
  return toActionResult(result);
}
