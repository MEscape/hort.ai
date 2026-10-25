import { z } from 'zod';

import { controlsSchema, profileIdSchema } from './onboarding-schema';

/** Explicit allowlist: the parent dashboard cannot edit the companion, interests or voice notice. */
export const parentControlsSchema = z
  .object({
    dailyLimitMinutes: controlsSchema.shape.dailyLimitMinutes,
    windowEnabled: controlsSchema.shape.windowEnabled,
    windowFrom: controlsSchema.shape.windowFrom,
    windowUntil: controlsSchema.shape.windowUntil,
    learningInsights: controlsSchema.shape.learningInsights,
  })
  .strict()
  .superRefine((values, context) => {
    const parsed = controlsSchema.safeParse({
      ...values,
      voiceEnabled: false,
      guardianConfirmed: true,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
    }
  });
export const updateParentControlsSchema = parentControlsSchema.safeExtend({
  profileId: profileIdSchema,
});
