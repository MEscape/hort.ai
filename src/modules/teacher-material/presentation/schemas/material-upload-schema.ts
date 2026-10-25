import { z } from 'zod';

import {
  MATERIAL_MAX_BYTES,
  MATERIAL_QUERY_LIMITS,
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
export const materialFormUploadSchema = materialUploadSchema.extend({
  sizeBytes: z.number().int().min(1).max(MATERIAL_FORM_MAX_BYTES),
});
