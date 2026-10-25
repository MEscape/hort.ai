import { z } from 'zod';

import {
  FEDERAL_STATES,
  GRADES,
  LEARNER_LIMITS,
  LEARNER_VALIDATION_CODES as CODES,
} from '../../application/contracts/learner-constraints';

/** The form holds the grade as the radio button's text; the action turns it into the number. */
export const GRADE_CHOICES = GRADES.map(String) as [string, ...string[]];

/**
 * Messages are stable codes, never prose: the UI translates them. Limits come from the domain
 * constants, so a number is defined exactly once. The domain validates again whatever this accepts.
 */
export const childProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(LEARNER_LIMITS.displayNameMin, { message: CODES.displayNameRequired })
    .max(LEARNER_LIMITS.displayNameMax, { message: CODES.displayNameTooLong }),
  federalState: z.enum(FEDERAL_STATES, { message: CODES.federalStateInvalid }),
  grade: z.enum(GRADE_CHOICES, { message: CODES.gradeInvalid }),
});

export type ChildProfileForm = z.infer<typeof childProfileSchema>;
