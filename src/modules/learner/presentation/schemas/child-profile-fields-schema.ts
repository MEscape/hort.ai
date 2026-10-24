import { z } from 'zod';

import {
  CHILD_PROFILE_COMPANIONS,
  CHILD_PROFILE_FEDERAL_STATES,
  CHILD_PROFILE_ID_MAX_LENGTH,
  CHILD_PROFILE_LIMITS,
  LEARNER_VALIDATION_CODES as CODES,
} from '../../application/contracts/learner-constraints';

/**
 * Field schemas shared by the create and edit forms. Messages are stable
 * codes, never prose: the UI translates them (i18n.md). Limits come from
 * the domain constants, so a number is defined exactly once.
 */
export const childProfileIdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(CHILD_PROFILE_ID_MAX_LENGTH, { message: CODES.idInvalid });

export const childProfileDisplayNameSchema = z
  .string()
  .trim()
  .min(1, { message: CODES.required })
  .max(CHILD_PROFILE_LIMITS.displayNameMax, { message: CODES.tooLong });

export const childProfileFederalStateSchema = z.enum(CHILD_PROFILE_FEDERAL_STATES, {
  message: CODES.optionUnknown,
});

export const childProfileGradeSchema = z.number({ message: CODES.numberInvalid });

export const childProfileCompanionSchema = z.enum(CHILD_PROFILE_COMPANIONS, {
  message: CODES.optionUnknown,
});

export const childProfileVoiceConsentSchema = z.boolean();
