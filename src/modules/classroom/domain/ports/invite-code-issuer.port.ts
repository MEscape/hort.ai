import type { NormalizedInviteCode } from '../models/invite-code';

export interface IssuedInviteCode {
  /** Shown to the teacher once, right after it was issued; never stored. */
  readonly code: NormalizedInviteCode;
  /** What is stored and looked up. */
  readonly hash: string;
}

/** Makes invite codes from a cryptographic random source and hashes them for lookup. */
export interface InviteCodeIssuer {
  issue(): IssuedInviteCode;
  hashOf(code: NormalizedInviteCode): string;
}
