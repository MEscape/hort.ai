import { z } from 'zod';

import { AUTH_VALIDATION_CODES as CODES } from '../../application/contracts/auth-constraints';

import { emailSchema, nameSchema, newPasswordSchema } from './auth-fields-schema';

/**
 * What the sign-up form edits. The confirmation is checked at the presentation boundary.
 */
export const signUpSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: CODES.passwordMismatch,
  });

export type SignUp = z.infer<typeof signUpSchema>;
