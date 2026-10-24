import { z } from 'zod';

import { childProfileIdSchema } from './child-profile-fields-schema';

export const deleteChildProfileSchema = z.object({ id: childProfileIdSchema });
