import { z } from 'zod';

import {
  DAILY_LIMIT_MINUTES,
  INTERESTS,
  LEARNER_LIMITS,
  LEARNER_VALIDATION_CODES as CODES,
} from '../../application/contracts/learner-constraints';

const PROFILE_ID_MAX_LENGTH = 64;
const MIN_WINDOW_MINUTES = 30;

/** What every step after the first sends along: which profile it is about. */
export const profileIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(PROFILE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const interestsSchema = z.object({
  interests: z
    .array(z.enum(INTERESTS, { message: CODES.interestsInvalid }))
    .max(LEARNER_LIMITS.maxInterests, { message: CODES.interestsTooMany }),
});
export type InterestsForm = z.infer<typeof interestsSchema>;

export const tutorSchema = z.object({
  tutorId: z.string().min(1, { message: CODES.tutorInvalid }),
});
export type TutorForm = z.infer<typeof tutorSchema>;

/** The daily limit travels as the Select's text; "none" is the choice without a limit. */
export const NO_LIMIT = 'none';
export const LIMIT_CHOICES = [NO_LIMIT, ...DAILY_LIMIT_MINUTES.map(String)] as [
  string,
  ...string[],
];

/**
 * The parent controls. Limits come from the domain constants; the form holds times as the Select's
 * text (minutes since midnight). The domain validates again whatever this accepts.
 */
export const controlsSchema = z
  .object({
    voiceEnabled: z.boolean(),
    dailyLimitMinutes: z.enum(LIMIT_CHOICES, { message: CODES.dailyLimitInvalid }),
    windowEnabled: z.boolean(),
    windowFrom: z.string(),
    windowUntil: z.string(),
    learningInsights: z.boolean(),
    guardianConfirmed: z.boolean().refine((confirmed) => confirmed, {
      message: CODES.guardianConfirmationRequired,
    }),
  })
  .superRefine((values, context) => {
    if (
      values.windowEnabled &&
      Number(values.windowUntil) - Number(values.windowFrom) < MIN_WINDOW_MINUTES
    ) {
      context.addIssue({ code: 'custom', path: ['windowUntil'], message: CODES.windowInvalid });
    }
  });
export type ControlsForm = z.infer<typeof controlsSchema>;

export const saveInterestsActionSchema = interestsSchema.extend({ profileId: profileIdSchema });
export const chooseTutorActionSchema = tutorSchema.extend({ profileId: profileIdSchema });
export const saveControlsActionSchema = controlsSchema.and(
  z.object({ profileId: profileIdSchema }),
);
export const completeSetupActionSchema = z.object({ profileId: profileIdSchema });
