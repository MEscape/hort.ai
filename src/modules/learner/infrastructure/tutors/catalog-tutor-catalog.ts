import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';

import type { TutorCatalogPort } from '../../domain/ports/tutor-catalog.port';

/** Reads the tutors module's checked-in catalog: only tutors marked `bereit` (ready) can be chosen. */
export function createCatalogTutors(catalog: TutorCatalog = tutorCatalog): TutorCatalogPort {
  return {
    isSelectable: (id) =>
      catalog.tutoren.some((tutor) => tutor.id === id && tutor.status === 'bereit'),
  };
}
