import { z } from 'zod';

import { AUTH_VALIDATION_CODES as CODES } from '../../application/contracts/auth-constraints';

import { nameSchema, newPasswordSchema, submittedPasswordSchema } from './auth-fields-schema';

/**
 * The account settings. Each schema names its fields explicitly: anything else a request sends (a
 * role, an address, an id) is dropped here, and the use cases accept nothing more either.
 */
export const displayNameSchema = z.object({ name: nameSchema });

/** What the action receives: the current password and the new one, nothing else. */
export const passwordChangeSchema = z.object({
  currentPassword: submittedPasswordSchema,
  newPassword: newPasswordSchema,
});

/** What the form edits: the action's fields plus the repeat, checked here only. */
export const passwordChangeFormSchema = passwordChangeSchema
  .extend({ confirmPassword: z.string() })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: CODES.passwordMismatch,
  });

export type DisplayNameForm = z.infer<typeof displayNameSchema>;
export type PasswordChangeForm = z.infer<typeof passwordChangeFormSchema>;
