import { z } from 'zod';

import {
  childProfileCompanionSchema,
  childProfileDisplayNameSchema,
  childProfileFederalStateSchema,
  childProfileGradeSchema,
  childProfileIdSchema,
  childProfileVoiceConsentSchema,
} from './child-profile-fields-schema';

/** Omitting a field leaves it alone; `null` clears an optional one. */
export const childProfileEditSchema = z.object({
  id: childProfileIdSchema,
  displayName: childProfileDisplayNameSchema.optional(),
  federalState: childProfileFederalStateSchema.optional(),
  grade: childProfileGradeSchema.optional(),
  companion: childProfileCompanionSchema.nullable().optional(),
  voiceConsent: childProfileVoiceConsentSchema.optional(),
});
