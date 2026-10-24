import 'server-only';

import type { TutorOption } from '@modules/learner';
import { tutorCatalog, tutorImageKey } from '@modules/tutors';

import { serverEnv } from '@lib/config/server';

/** The tutor catalog names a main colour; the tile behind the picture takes the matching tone. */
const TONE_BY_COLOUR: Readonly<Record<string, TutorOption['tone']>> = { blau: 'sky', rot: 'bloom' };

/**
 * The companions a parent can choose, taken from the checked-in tutor catalog: only those marked
 * ready, with just what the setup shows. The picture URL points at public storage; without a storage
 * address it stays empty and the card falls back to its icon.
 */
export function buildTutorOptions(): readonly TutorOption[] {
  const base = serverEnv.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, '');

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
      tone: TONE_BY_COLOUR[tutor.farbe ?? ''] ?? 'amber',
      imageUrl: base === undefined ? '' : `${base}/${tutorImageKey(tutor.id, 'mund_zu')}`,
    }));
}
