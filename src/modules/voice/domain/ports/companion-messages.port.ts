import type { AppResultAsync } from '@lib/result';

import type { CompanionMessageRef, PredefinedWording } from '../models/companion-message';
import type { ChildProfileId } from '../models/ids';

/** Whether the child may use speech, and whose voice is theirs. */
export interface ChildCompanion {
  readonly voiceConsent: boolean;
  /** The chosen companion's catalog id, `null` while none is chosen. */
  readonly tutorId: string | null;
}

/** Reads what the companion said to the signed-in parent's own child, from server-side state only. */
export interface CompanionMessages {
  /** The child profile, if it is the parent's own; a foreign one answers like a missing one. */
  companionOf(childProfileId: ChildProfileId): AppResultAsync<ChildCompanion>;
  /** The validated words of that message, `null` when the child has no such message. */
  textOf(
    childProfileId: ChildProfileId,
    message: CompanionMessageRef,
    wording: PredefinedWording,
  ): AppResultAsync<string | null>;
}
