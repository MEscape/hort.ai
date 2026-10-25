import type { HintLevel } from '../../domain/models/hint-level';

/** Asking for one hint for one child profile. Every field is checked by the use case. */
export interface RequestHintInput {
  readonly childProfileId: string;
  /** The task as the child typed or dictated it. */
  readonly task: string;
  /** The task's school subject, one of `HINT_SUBJECTS`; it picks the curriculum that grounds the hint. */
  readonly subject: string;
  /**
   * Chosen by the backend, never by the child or the AI.
   *
   * TODO(#30): the hint ladder picks the level from the session state; until then the server-side caller does.
   */
  readonly level: HintLevel;
}
