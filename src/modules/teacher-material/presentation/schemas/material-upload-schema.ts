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
