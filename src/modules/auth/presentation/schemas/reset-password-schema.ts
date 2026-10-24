import { z } from 'zod';

import { AUTH_VALIDATION_CODES as CODES } from '../../application/contracts/auth-constraints';

import { newPasswordSchema, tokenSchema } from './auth-fields-schema';

/** What the form edits. The token comes from the link, not from the user. */
export const resetPasswordFormSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: CODES.passwordMismatch,
  });

/** What the action receives: the form values plus the token from the link. */
export const resetPasswordActionSchema = z.object({
  token: tokenSchema,
  newPassword: newPasswordSchema,
});

export type ResetPasswordForm = z.infer<typeof resetPasswordFormSchema>;
