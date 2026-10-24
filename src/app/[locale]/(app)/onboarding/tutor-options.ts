import 'server-only';

import type { TutorOption } from '@modules/learner';
import { tutorCatalog, tutorImageKey, tutorIntroKey } from '@modules/tutors';

import { serverEnv } from '@lib/config/server';

/**
 * TEMPORARY. The open-mouth pictures were exported with a different framing than the closed ones
 * (measured on the uploaded files: Max is 8 px left, Lili a whole 50 px left, Fina on another canvas
 * size and scale, and Fina's two drawings also differ in pose), so the mouth swap makes the
 * characters jump. These numbers are the best fit of the open picture onto the closed one (least
 * pixel difference); Max and Lili then match closely, Fina only partly. Delete this table when both pictures of every character share one canvas.
 */
const MOUTH_ALIGNMENT: Readonly<Record<string, TutorOption['openAlignment']>> = {
  max: { scaleX: 1, scaleY: 0.9991, x: 0.0084, y: 0 },
  lili: { scaleX: 1.0009, scaleY: 1, x: 0.0544, y: 0 },
  fina: { scaleX: 0.9569, scaleY: 0.9747, x: -0.0019, y: 0 },
};

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
      openAlignment: MOUTH_ALIGNMENT[tutor.id],
      introUrl: url(tutorIntroKey(tutor.id)),
    }));
}
