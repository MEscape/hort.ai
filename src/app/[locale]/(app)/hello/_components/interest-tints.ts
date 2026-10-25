import type { Interest } from '@modules/learner/client';

/** One soft colour per interest for the disc behind its picture (only tokens; the label says the rest). */
export const INTEREST_TINTS = {
  nature: 'bg-success-subtle text-success',
  animals: 'bg-bloom/35 text-bloom-copy',
  science: 'bg-info-subtle text-info',
  art: 'bg-nudge-subtle text-nudge',
  music: 'bg-hint-subtle text-hint',
  sports: 'bg-accent/30 text-accent-copy',
  technology: 'bg-secondary text-secondary-copy',
  stories: 'bg-highlight text-primary-copy',
  puzzles: 'bg-warning-subtle text-warning',
  history: 'bg-sunken text-primary-copy',
} as const satisfies Record<Interest, string>;
