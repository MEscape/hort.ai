import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';

import { isTutorPhrase } from '../../domain/models/system-phrase';

import uiLines from './ui-lines.json';

import type { TutorPhrase, UiLine } from '../../domain/models/system-phrase';
import type { SystemPhrases } from '../../domain/ports/system-phrases.port';

/** Which catalog field holds which line. */
const CATALOG_FIELD = {
  greeting: 'begruessung',
  praise: 'lob_beispiel',
  tip: 'tipp_beispiel',
} as const satisfies Record<TutorPhrase, string>;

/** The screen lines, typed against the closed list: a missing or extra line fails to compile. */
const UI_LINE_TEXT: Readonly<Record<UiLine, string>> = uiLines;

/**
 * The fixed lines of every tutor that is `bereit`: its own lines from the checked-in tutor catalog
 * and the shared screen lines (`ui-lines.json`) that every ready tutor says in its own voice. They
 * are reviewed text, so they may be spoken without passing through the AI output contract. The
 * narrator has no fixed lines yet. Rewording a line is an edit of a JSON file, not of code.
 */
export function catalogSystemPhrases(catalog: TutorCatalog = tutorCatalog): SystemPhrases {
  const ready = new Map(
    catalog.tutoren.filter((tutor) => tutor.status === 'bereit').map((tutor) => [tutor.id, tutor]),
  );
  return {
    phraseFor: (speakerId, phrase) => {
      const tutor = ready.get(speakerId);
      if (tutor === undefined) {
        return null;
      }
      return isTutorPhrase(phrase) ? tutor[CATALOG_FIELD[phrase]] : UI_LINE_TEXT[phrase];
    },
  };
}
