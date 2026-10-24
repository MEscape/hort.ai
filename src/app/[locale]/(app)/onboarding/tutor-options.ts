import 'server-only';

import type { TutorOption } from '@modules/learner';
import { tutorCatalog, tutorImageKey, tutorIntroKey } from '@modules/tutors';

import { serverEnv } from '@lib/config/server';

/**
 * The companions a parent can choose, taken from the checked-in tutor catalog: only those marked
 * ready, with just what the setup shows. Pictures and the spoken introduction live in the public
 * container of the environment the app runs in: `STORAGE_PUBLIC_BASE_URL` is set per environment
 * (local, preview, production), so each one reads its own container. Without an address the URLs
 * stay empty, the cards fall back to an icon and the play button says the sound is unavailable.
 */
export function buildTutorOptions(): readonly TutorOption[] {
  const base = serverEnv.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, '');
  const url = (key: string) => (base === undefined ? '' : `${base}/${key}`);

  return tutorCatalog.tutoren
    .filter((tutor) => tutor.status === 'bereit')
    .map((tutor) => ({
      id: tutor.id,
      name: tutor.name,
      animal: tutor.tier,
      description: tutor.kurzbeschreibung,
      traits: tutor.persoenlichkeit,
      topics: tutor.lieblingsthemen,
      greeting: tutor.begruessung,
      voice: tutor.stimme.charakter,
      imageUrl: url(tutorImageKey(tutor.id, 'mund_zu')),
      imageOpenUrl: url(tutorImageKey(tutor.id, 'mund_auf')),
      introUrl: url(tutorIntroKey(tutor.id)),
    }));
}
