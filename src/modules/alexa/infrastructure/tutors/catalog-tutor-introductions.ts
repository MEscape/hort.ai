import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';

import { parseTutorId } from '../../domain/models/ids';

import type { TutorIntroduction } from '../../domain/ports/tutor-voice.port';

/**
 * Every tutor that is `bereit`, in catalog order, with its catalog greeting (`begruessung`): reviewed
 * lines the voice module speaks without a ticket. Rewording one is an edit of `tutors.json`, not of code.
 */
export function catalogTutorIntroductions(
  catalog: TutorCatalog = tutorCatalog,
): readonly TutorIntroduction[] {
  return catalog.tutoren
    .filter((tutor) => tutor.status === 'bereit')
    .flatMap((tutor) => {
      const tutorId = parseTutorId(tutor.id);
      return tutorId.isOk() ? [{ tutorId: tutorId.value, text: tutor.begruessung }] : [];
    });
}
