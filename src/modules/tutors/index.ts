import catalogJson from './domain/tutors.json';
import { tutorCatalogSchema } from './domain/tutor';

import type { TutorCatalog } from './domain/tutor';

/**
 * The validated tutor catalog. Parsed once at import: a broken `tutors.json` fails the build
 * and the tests instead of reaching a child's screen.
 */
export const tutorCatalog: TutorCatalog = tutorCatalogSchema.parse(catalogJson);

export {
  TUTOR_IMAGE_FILES,
  TUTOR_STORAGE_PREFIX,
  tutorCatalogSchema,
  tutorImageKey,
} from './domain/tutor';
export type { Tutor, TutorCatalog, TutorImage } from './domain/tutor';
