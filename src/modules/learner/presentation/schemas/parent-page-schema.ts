import { z } from 'zod';

/** URL controls choose known views only; they never supply an owner, role or tenant. */
export const parentPageSchema = z.object({
  section: z
    .enum(['overview', 'learning', 'assignments', 'time', 'settings', 'privacy'])
    .catch('overview'),
  range: z.enum(['today', 'week', 'month']).catch('week'),
});
