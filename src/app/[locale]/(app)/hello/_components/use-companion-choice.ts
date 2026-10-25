'use client';

import { useState } from 'react';

import { bestFits } from '@modules/learner/client';
import type { Interest, TutorOption } from '@modules/learner/client';

import type { CarouselCharacter } from '@components/shared/character-carousel';

export interface CompanionChoiceOptions {
  readonly tutors: readonly TutorOption[];
  readonly interests: readonly Interest[];
  readonly initialTutorId: string | null;
  /** The translated mark for a companion that fits the child's interests. */
  readonly fitBadge: string;
}

/**
 * Which companion is in the middle of the carousel, and the carousel's characters. The parent's
 * choice starts in the middle; without one, the first companion that fits the child's interests
 * (or simply the first) does. What is in the middle is only a choice once the child continues.
 * The open-mouth picture is left out where there is none, so no companion downloads a blank.
 */
export function useCompanionChoice({
  tutors,
  interests,
  initialTutorId,
  fitBadge,
}: CompanionChoiceOptions) {
  const fits = bestFits(tutors, interests);
  const start =
    tutors.find(({ id }) => id === initialTutorId) ?? tutors.find(({ id }) => fits.has(id));
  const [activeId, setActiveId] = useState(start?.id ?? tutors[0]?.id ?? '');

  const characters: CarouselCharacter[] = tutors.map((tutor) => ({
    id: tutor.id,
    name: tutor.name,
    imageUrl: tutor.imageUrl,
    imageOpenUrl: tutor.imageOpenUrl === '' ? undefined : tutor.imageOpenUrl,
    openAlignment: tutor.openAlignment,
    face: tutor.face,
    badge: fits.has(tutor.id) ? fitBadge : undefined,
  }));

  return { characters, activeId, setActiveId, active: tutors.find(({ id }) => id === activeId) };
}
