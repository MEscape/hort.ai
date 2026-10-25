import { z } from 'zod';

import {
  CLASSROOM_FEDERAL_STATES,
  CLASSROOM_ID_MAX_LENGTH,
  CLASSROOM_LIMITS,
  CLASSROOM_NAME_PATTERN,
  CLASSROOM_SUBJECTS,
  CLASSROOM_VALIDATION_CODES as CODES,
} from '../../application/contracts/classroom-constraints';

/**
 * Action input schemas. Messages are stable codes, never prose: the UI translates them (i18n.md).
 * Limits come from the domain constants, so a number is defined exactly once. The domain checks
 * every rule again; these only shape the input. Unknown keys (a tenant, an owner) are dropped.
 */
const idSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(CLASSROOM_ID_MAX_LENGTH, { message: CODES.idInvalid });

const nameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: CODES.required })
  .regex(CLASSROOM_NAME_PATTERN, { message: CODES.nameInvalid });

const gradeSchema = z
  .number({ message: CODES.numberInvalid })
  .int({ message: CODES.numberInvalid })
  .min(CLASSROOM_LIMITS.gradeMin, { message: CODES.numberInvalid })
  .max(CLASSROOM_LIMITS.gradeMax, { message: CODES.numberInvalid });

/** Long enough for `ABCD-EFGH` with stray spaces; the domain decides whether it is a code. */
const INVITE_CODE_INPUT_MAX = 32;

export const newClassroomSchema = z.object({
  name: nameSchema,
  federalState: z.enum(CLASSROOM_FEDERAL_STATES, { message: CODES.optionUnknown }),
  grade: gradeSchema,
  subject: z.enum(CLASSROOM_SUBJECTS, { message: CODES.optionUnknown }),
});

export const renameClassroomSchema = z.object({ id: idSchema, name: nameSchema });

export const classroomIdSchema = z.object({ id: idSchema });

export const joinClassroomSchema = z.object({
  childProfileId: idSchema,
  inviteCode: z
    .string()
    .min(1, { message: CODES.required })
    .max(INVITE_CODE_INPUT_MAX, { message: CODES.tooLong }),
});

export const childProfileIdSchema = z.object({ childProfileId: idSchema });
