import { z } from 'zod';

import { RETURN_PATH_MAX_LENGTH } from '../navigation/return-path';

import { emailSchema, submittedPasswordSchema } from './auth-fields-schema';

export const signInSchema = z.object({
  email: emailSchema,
  password: submittedPasswordSchema,
});

export type SignIn = z.infer<typeof signInSchema>;

/** The action also receives where to go next; the form itself has no such field. */
export const signInActionSchema = signInSchema.extend({
  returnTo: z.string().max(RETURN_PATH_MAX_LENGTH).optional(),
});
