import { z } from 'zod';

export const materialUploadSchema = z.object({
  classroomId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  title: z.string().trim().min(1).max(200),
  contentType: z.literal('text/plain'),
  sizeBytes: z.number().int().min(1).max(10_485_760),
});
export const materialIdSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) });
