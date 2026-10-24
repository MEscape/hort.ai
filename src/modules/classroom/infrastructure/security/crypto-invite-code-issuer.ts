import { createHash, randomInt } from 'node:crypto';

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  inviteCodeFromPositions,
} from '../../domain/models/invite-code';

import type { NormalizedInviteCode } from '../../domain/models/invite-code';
import type { InviteCodeIssuer } from '../../domain/ports/invite-code-issuer.port';

function hashOf(code: NormalizedInviteCode): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Codes from the operating system's CSPRNG (`randomInt` is uniform over the alphabet, no modulo
 * bias). The stored value is the SHA-256 hex digest of the canonical code
 * (`Classroom_invite_code_rule`).
 */
export const cryptoInviteCodeIssuer: InviteCodeIssuer = {
  issue() {
    const positions = Array.from({ length: INVITE_CODE_LENGTH }, () =>
      randomInt(INVITE_CODE_ALPHABET.length),
    );
    const code = inviteCodeFromPositions(positions);
    return { code, hash: hashOf(code) };
  },
  hashOf,
};
