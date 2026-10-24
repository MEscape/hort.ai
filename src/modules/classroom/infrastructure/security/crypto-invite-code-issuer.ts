import { createHash, randomInt } from 'node:crypto';

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from '../../domain/models/invite-code';

import type { NormalizedInviteCode } from '../../domain/models/invite-code';
import type { InviteCodeIssuer } from '../../domain/ports/invite-code-issuer.port';

/**
 * Codes from the operating system's CSPRNG (`randomInt` is uniform, no modulo bias). The stored
 * value is the SHA-256 hex digest of the canonical code (`Classroom_invite_code_rule`).
 */
export const cryptoInviteCodeIssuer: InviteCodeIssuer = {
  issue() {
    let raw = '';
    for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
      raw += INVITE_CODE_ALPHABET.charAt(randomInt(INVITE_CODE_ALPHABET.length));
    }
    const code = normalizeInviteCode(raw);
    if (code === null) {
      throw new Error('An issued invite code is always in canonical form.');
    }
    return { code, hash: this.hashOf(code) };
  },
  hashOf(code: NormalizedInviteCode) {
    return createHash('sha256').update(code, 'utf8').digest('hex');
  },
};
