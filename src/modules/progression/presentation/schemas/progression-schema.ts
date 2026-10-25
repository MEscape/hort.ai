import { z } from 'zod';

import { PROGRESSION_VALIDATION_CODES as CODES } from '../../application/contracts/progression-constraints';

const CHILD_ID_MAX_LENGTH = 64;

/** What every progression request sends: which child it is about. The owner never travels. */
export const claimDailyRewardActionSchema = z.object({
  childProfileId: z
    .string()
    .min(1, { message: CODES.idInvalid })
    .max(CHILD_ID_MAX_LENGTH, { message: CODES.idInvalid }),
});
