import { describe, expect, it } from 'vitest';

import {
  createClassroomDraft,
  parseClassroomName,
} from '@modules/classroom/domain/models/classroom';
import {
  INVITE_CODE_ALPHABET,
  formatInviteCode,
  normalizeInviteCode,
} from '@modules/classroom/domain/models/invite-code';
import { cryptoInviteCodeIssuer } from '@modules/classroom/infrastructure/security/crypto-invite-code-issuer';

describe('invite codes', () => {
  it('uses no symbols a child can mix up', () => {
    for (const symbol of '0O1IL2Z5S8BGQ') {
      expect(INVITE_CODE_ALPHABET).not.toContain(symbol);
    }
  });

  it('issues different codes in canonical form with a SHA-256 hash', () => {
    const codes = new Set<string>();
    for (let index = 0; index < 50; index += 1) {
      const issued = cryptoInviteCodeIssuer.issue();
      expect(normalizeInviteCode(issued.code)).toBe(issued.code);
      expect(issued.hash).toMatch(/^[0-9a-f]{64}$/);
      codes.add(issued.code);
    }
    expect(codes.size).toBe(50);
  });

  it('accepts lower case, spaces and the dash, and hashes them like the canonical code', () => {
    const { code, hash } = cryptoInviteCodeIssuer.issue();
    const typed = normalizeInviteCode(` ${formatInviteCode(code).toLowerCase()} `);

    expect(typed).toBe(code);
    expect(cryptoInviteCodeIssuer.hashOf(typed!)).toBe(hash);
  });

  it('rejects anything that cannot be a code', () => {
    for (const raw of ['', 'ACDE', 'ACDEFHJKM', 'ACDE-FHJ0', 'A'.repeat(40)]) {
      expect(normalizeInviteCode(raw)).toBeNull();
    }
  });
});

describe('classroom rules', () => {
  it('accepts a primary-school class and trims its name', () => {
    const result = createClassroomDraft({
      name: ' 3a ',
      federalState: 'he',
      grade: 3,
      subject: 'math',
    });
    expect(result._unsafeUnwrap().name).toBe('3a');
  });

  it('reports every broken field', () => {
    const result = createClassroomDraft({ name: '', federalState: 'xx', grade: 2.5, subject: 'x' });
    expect(Object.keys(result._unsafeUnwrapErr().fieldErrors).sort()).toEqual([
      'federalState',
      'grade',
      'name',
      'subject',
    ]);
  });

  it('refuses a name longer than 80 characters', () => {
    expect(parseClassroomName('x'.repeat(81)).isErr()).toBe(true);
  });
});
