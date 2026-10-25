import { tutorCatalogSchema } from '../schemas/tutor-catalog-schema';

import catalogJson from './tutors.json';

import type { TutorCatalog } from '../schemas/tutor-catalog-schema';

/**
 * The validated tutor catalog. Parsed once at import: a broken `tutors.json` fails the build
 * and the tests instead of reaching a child's screen.
 */
export const tutorCatalog: TutorCatalog = tutorCatalogSchema.parse(catalogJson);

/** Where every tutor's pictures live in the public container: `tutors/<id>/<file>`. */
export const TUTOR_STORAGE_PREFIX = 'tutors';

const TUTOR_INTRO_FILE = 'vorstellung.mp3';

const TUTOR_IMAGE_FILES = { mund_zu: 'mund-zu.svg', mund_auf: 'mund-auf.svg' } as const;

export type TutorImage = keyof typeof TUTOR_IMAGE_FILES;

/** The storage key of one of a tutor's pictures, relative to the public container. */
export function tutorImageKey(id: string, image: TutorImage): string {
  return `${TUTOR_STORAGE_PREFIX}/${id}/${TUTOR_IMAGE_FILES[image]}`;
}

/**
 * The storage key of a tutor's spoken introduction (15 to 19 seconds, MP3, generated once and stored,
 * so playing it needs no speech provider), relative to the public container.
 */
export function tutorIntroKey(id: string): string {
  return `${TUTOR_STORAGE_PREFIX}/${id}/${TUTOR_INTRO_FILE}`;
}
