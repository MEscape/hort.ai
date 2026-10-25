/** A parent has one child in the MVP; the bound only keeps a read from ever being unbounded (performance.md). */
export const OWN_PROFILES_LIMIT = 10;

/** The parent view reads at most this many tasks and assignments per period; more is shown as partial. */
export const PARENT_RECORD_LIMIT = 100;

/** Hints, answers or questions per task above this are reported as unavailable, never as an undercount. */
export const PARENT_EVIDENCE_LIMIT = 100;
