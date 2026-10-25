/**
 * The invite code a teacher hands out and a parent types in for their child.
 *
 * - Alphabet: upper-case letters and digits a child (or a parent reading a worksheet) cannot mix
 *   up. Left out: 0/O/Q, 1/I/L, 2/Z, 5/S, 8/B and G (next to 6).
 * - Length: 8 symbols from 23 is about 36 bits, so one guess hits one of a few thousand active
 *   classes with odds below 1 in 10 million; with the per-parent and per-address budgets on
 *   joining (`CLASSROOM_RATE_LIMITS`) guessing is not a practical way in.
 * - It is shown as two groups of four (`ABCD-EFGH`); spaces, dashes and lower case are accepted.
 * - Only a hash is stored and looked up (unique index), so there is no string comparison whose
 *   timing depends on the secret, and a new code replaces the old hash at once.
 */
export const INVITE_CODE_ALPHABET = 'ACDEFHJKMNPRTUVWXY34679';
export const INVITE_CODE_LENGTH = 8;
const GROUP_SIZE = 4;

/** Longest raw input looked at; anything longer is not a code (and is not normalised). */
const MAX_RAW_LENGTH = 32;

/** A code in canonical form: exactly `INVITE_CODE_LENGTH` symbols of the alphabet. */
export type NormalizedInviteCode = string & { readonly __inviteCode: true };

/** What a parent typed, in canonical form, or `null` when it cannot be a code at all. */
export function normalizeInviteCode(raw: string): NormalizedInviteCode | null {
  if (raw.length > MAX_RAW_LENGTH) {
    return null;
  }
  const compact = raw.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length !== INVITE_CODE_LENGTH) {
    return null;
  }
  for (const symbol of compact) {
    if (!INVITE_CODE_ALPHABET.includes(symbol)) {
      return null;
    }
  }
  return compact as NormalizedInviteCode; // Checked above: every symbol is from the alphabet.
}

/** `ABCDEFGH` -> `ABCD-EFGH`, the form a teacher sees. */
export function formatInviteCode(code: NormalizedInviteCode): string {
  return `${code.slice(0, GROUP_SIZE)}-${code.slice(GROUP_SIZE)}`;
}

/**
 * Builds a code from random positions in the alphabet (one per symbol, any integer; reduced into
 * range). The random source is the issuer's; this only says what a code is made of.
 */
export function inviteCodeFromPositions(positions: readonly number[]): NormalizedInviteCode {
  const symbols = positions
    .slice(0, INVITE_CODE_LENGTH)
    .map((position) =>
      INVITE_CODE_ALPHABET.charAt(Math.abs(position) % INVITE_CODE_ALPHABET.length),
    );
  return symbols.join('') as NormalizedInviteCode; // Every symbol is from the alphabet.
}
