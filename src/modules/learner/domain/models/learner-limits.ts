/**
 * Limits of the profile and the parent controls. The database repeats the name length, the grade
 * range, the interest count and the allowed-window rules as CHECK constraints; presentation reads
 * these through the application's constraints contract.
 */
export const LEARNER_LIMITS = {
  displayNameMin: 1,
  displayNameMax: 24,
  maxInterests: 4,
  /** The allowed window is set in steps of this many minutes. */
  windowStepMinutes: 15,
  /** The allowed window is at least this wide. */
  windowMinWidthMinutes: 30,
  /** Minutes in a day: the latest end of the allowed window. */
  dayMinutes: 1440,
} as const;
