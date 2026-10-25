import { z } from 'zod';

import {
  MATERIAL_MAX_BYTES,
  MATERIAL_POWERPOINT_CONTENT_TYPE,
  MATERIAL_QUERY_LIMITS,
  MATERIAL_WORD_CONTENT_TYPE,
} from '../../application/contracts/teacher-material-constraints';

export const materialUploadSchema = z.object({
  classroomId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  title: z.string().trim().min(1).max(MATERIAL_QUERY_LIMITS.title),
  contentType: z.literal('text/plain'),
  sizeBytes: z.number().int().min(1).max(MATERIAL_MAX_BYTES),
});
export const materialIdSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) });
/**
 * The class page posts the file to a Server Action, whose request body Next.js caps at 1 MB.
 * Plain-text curriculum material fits comfortably; larger files are refused before the upload.
 */
export const MATERIAL_FORM_MAX_BYTES = Math.min(900_000, MATERIAL_MAX_BYTES);
/** What the class page accepts: text as is, Word and PowerPoint files are read to text on the server. */
export const MATERIAL_FORM_CONTENT_TYPES = [
  'text/plain',
  MATERIAL_WORD_CONTENT_TYPE,
  MATERIAL_POWERPOINT_CONTENT_TYPE,
] as const;
/** `accept` for the file input: extensions for systems that send no MIME type. */
export const MATERIAL_FORM_ACCEPT = `.txt,.docx,.pptx,${MATERIAL_FORM_CONTENT_TYPES.join(',')}`;
const FORM_EXTENSIONS: Readonly<Record<string, (typeof MATERIAL_FORM_CONTENT_TYPES)[number]>> = {
  txt: 'text/plain',
  docx: MATERIAL_WORD_CONTENT_TYPE,
  pptx: MATERIAL_POWERPOINT_CONTENT_TYPE,
};
/** The content type of a chosen file: its own MIME type, else (some systems send none) its extension. */
export function materialFormContentType(file: {
  readonly name: string;
  readonly type: string;
}): string {
  const known = MATERIAL_FORM_CONTENT_TYPES.find((type) => type === file.type);
  if (known !== undefined) {
    return known;
  }
  const extension = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? '';
  return file.type === '' || file.type === 'application/octet-stream'
    ? (FORM_EXTENSIONS[extension] ?? file.type)
    : file.type;
}
export const materialFormUploadSchema = materialUploadSchema.extend({
  contentType: z.enum(MATERIAL_FORM_CONTENT_TYPES),
  sizeBytes: z.number().int().min(1).max(MATERIAL_FORM_MAX_BYTES),
});
