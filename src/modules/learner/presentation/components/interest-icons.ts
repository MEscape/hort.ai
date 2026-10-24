import {
  BookOpen,
  Cpu,
  Dumbbell,
  FlaskConical,
  Landmark,
  Leaf,
  Music,
  Palette,
  PawPrint,
  Puzzle,
} from '@components/ui/icons';

import type { Interest } from '../../application/contracts/learner-constraints';

/** One picture per interest, so a child who cannot read yet can still point at it. */
export const INTEREST_ICONS = {
  nature: Leaf,
  animals: PawPrint,
  science: FlaskConical,
  art: Palette,
  music: Music,
  sports: Dumbbell,
  technology: Cpu,
  stories: BookOpen,
  puzzles: Puzzle,
  history: Landmark,
} as const satisfies Record<Interest, unknown>;

/**
 * The tutor catalog names what each companion likes in German words ("Sport", "Natur"). This is the
 * bridge from a chosen interest to those words, so a companion can be recommended. Editorial data:
 * a word that no tutor uses simply recommends nobody.
 */
export const INTEREST_TOPICS = {
  nature: ['Natur'],
  animals: ['Tiere'],
  science: ['Natur', 'Technik'],
  art: ['Kunst'],
  music: [],
  sports: ['Sport'],
  technology: ['Technik'],
  stories: ['Lesen', 'Deutsch'],
  puzzles: ['Rätsel', 'Mathe'],
  history: ['Geschichte'],
} as const satisfies Record<Interest, readonly string[]>;
