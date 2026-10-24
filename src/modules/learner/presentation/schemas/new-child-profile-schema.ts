import { z } from 'zod';

import {
  childProfileCompanionSchema,
  childProfileDisplayNameSchema,
  childProfileFederalStateSchema,
  childProfileGradeSchema,
  childProfileVoiceConsentSchema,
} from './child-profile-fields-schema';

export const newChildProfileSchema = z.object({
  displayName: childProfileDisplayNameSchema,
  federalState: childProfileFederalStateSchema,
  grade: childProfileGradeSchema,
  companion: childProfileCompanionSchema.nullable().optional(),
  voiceConsent: childProfileVoiceConsentSchema,
});
