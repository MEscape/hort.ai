import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';

import type { SystemPhrase } from '../../domain/models/system-phrase';
import type { SystemPhrases } from '../../domain/ports/system-phrases.port';

/** Which catalog field holds which line. */
const CATALOG_FIELD = {
  greeting: 'begruessung',
  praise: 'lob_beispiel',
  tip: 'tipp_beispiel',
} as const satisfies Record<SystemPhrase, string>;

/**
 * The fixed lines of every tutor that is `bereit`, read from the checked-in tutor catalog. They are
 * reviewed text, so they may be spoken without passing through the AI output contract. The narrator
 * has no fixed lines yet. Rewording a line is an edit of `tutors.json`, not of code.
 */
export function catalogSystemPhrases(catalog: TutorCatalog = tutorCatalog): SystemPhrases {
  const ready = new Map(
    catalog.tutoren.filter((tutor) => tutor.status === 'bereit').map((tutor) => [tutor.id, tutor]),
  );
  return {
    phraseFor: (speakerId, phrase) => ready.get(speakerId)?.[CATALOG_FIELD[phrase]] ?? null,
  };
}
