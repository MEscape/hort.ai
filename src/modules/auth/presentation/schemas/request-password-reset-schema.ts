import { z } from 'zod';

import { emailSchema } from './auth-fields-schema';

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export type RequestPasswordReset = z.infer<typeof requestPasswordResetSchema>;
