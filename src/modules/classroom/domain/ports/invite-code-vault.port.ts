import type { ClassroomOwnerScope } from './classroom.repository';
import type { NormalizedInviteCode } from '../models/invite-code';

/**
 * Keeps a class's current invite code readable for its teacher, encrypted at rest. The hash stays
 * the only thing a join looks up; this is for showing the code again, nothing else. The owner scope
 * is bound into the ciphertext, so a sealed code copied onto another teacher's class opens to
 * nothing.
 */
export interface InviteCodeVault {
  /** The sealed code to store, or `null` when no key is configured (hash-only, as before). */
  seal(code: NormalizedInviteCode, owner: ClassroomOwnerScope): string | null;
  /** The code, or `null`: no key, another key, another owner, or a damaged value. Never throws. */
  open(sealed: string, owner: ClassroomOwnerScope): NormalizedInviteCode | null;
}
