import { z } from 'zod';

import { submittedPasswordSchema } from './auth-fields-schema';

/** Reauthentication accepts only the current parent's password, never a client-chosen identity. */
export const parentAccessSchema = z.object({ password: submittedPasswordSchema }).strict();
