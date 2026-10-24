import { describe, expect, it } from 'vitest';

import { MAX_SUBJECT_PART_LENGTH, buildBucketKey } from '@lib/rate-limit';
import type { RateLimitSubject } from '@lib/rate-limit';

const SECRET = 's'.repeat(32);

function keyOf(subject: RateLimitSubject, secret = SECRET, policyId = 'auth.sign-in'): string {
  const result = buildBucketKey(policyId, subject, secret);
  if (!result.isValid) {
    throw new Error(`expected a valid key, got: ${result.problem}`);
  }
  return result.key;
}

function problemOf(subject: RateLimitSubject): string {
  const result = buildBucketKey('auth.sign-in', subject, SECRET);
  if (result.isValid) {
    throw new Error('expected a problem');
  }
  return result.problem;
}

describe('buildBucketKey', () => {
  it('gives the global subject one readable counter per policy', () => {
    expect(keyOf({ kind: 'global' })).toBe('auth.sign-in:global');
  });

  it('refuses an unresolved client, which has no counter', () => {
    expect(problemOf({ kind: 'unresolved-client' })).toBe('an unresolved client has no counter');
  });

  it('keys a counted subject as policy, kind and a fixed-length keyed hash', () => {
    expect(keyOf({ kind: 'client', address: '203.0.113.7' })).toMatch(
      /^auth\.sign-in:client:[0-9a-f]{64}$/,
    );
  });

  it('never puts the subject itself into the key', () => {
    const key = keyOf({ kind: 'identifier', value: 'ada@example.org' });

    expect(key).not.toContain('ada');
    expect(key).not.toContain('example');
  });

  it('is stable for the same subject and secret', () => {
    const subject: RateLimitSubject = { kind: 'client', address: '203.0.113.7' };

    expect(keyOf(subject)).toBe(keyOf({ ...subject }));
  });

  it('depends on the secret', () => {
    const subject: RateLimitSubject = { kind: 'client', address: '203.0.113.7' };

    expect(keyOf(subject, 'a'.repeat(32))).not.toBe(keyOf(subject, 'b'.repeat(32)));
  });

  it('does not share a counter between kinds with the same text', () => {
    const text = 'same-text';

    const keys = new Set([
      keyOf({ kind: 'client', address: text }),
      keyOf({ kind: 'identifier', value: text }),
      keyOf({ kind: 'actor', tenantId: text, actorId: text }),
    ]);

    expect(keys.size).toBe(3);
  });

  it('keeps ("ab","c") apart from ("a","bc") for actors', () => {
    expect(keyOf({ kind: 'actor', tenantId: 'ab', actorId: 'c' })).not.toBe(
      keyOf({ kind: 'actor', tenantId: 'a', actorId: 'bc' }),
    );
  });

  it('normalises identifiers and clients (NFKC, trim, lower case)', () => {
    const plain = keyOf({ kind: 'identifier', value: 'ada@example.org' });

    expect(keyOf({ kind: 'identifier', value: '  ADA@Example.ORG ' })).toBe(plain);
    expect(keyOf({ kind: 'identifier', value: 'ada＠example.org' })).toBe(plain);
    expect(keyOf({ kind: 'client', address: ' 2001:DB8::1 ' })).toBe(
      keyOf({ kind: 'client', address: '2001:db8::1' }),
    );
  });

  it('uses actor ids exactly as given', () => {
    expect(keyOf({ kind: 'actor', tenantId: 'T1', actorId: 'U1' })).not.toBe(
      keyOf({ kind: 'actor', tenantId: 't1', actorId: 'u1' }),
    );
  });

  it('refuses an empty subject part, also after trimming', () => {
    expect(problemOf({ kind: 'identifier', value: '   ' })).toBe('identifier subject is empty');
    expect(problemOf({ kind: 'actor', tenantId: 't', actorId: '' })).toBe('actor subject is empty');
  });

  it('refuses a part over the limit after normalising', () => {
    const value = 'a'.repeat(MAX_SUBJECT_PART_LENGTH + 1);

    expect(problemOf({ kind: 'identifier', value })).toBe('identifier subject is too long');
    expect(keyOf({ kind: 'identifier', value: value.slice(1) })).toMatch(/:identifier:/);
  });

  it('refuses an oversized raw value without normalising it', () => {
    const value = 'a'.repeat(MAX_SUBJECT_PART_LENGTH * 4 + 1);

    expect(problemOf({ kind: 'client', address: value })).toBe('client subject is too long');
  });

  it('accepts text that normalisation shortens below the limit', () => {
    // 'e' + combining acute composes into one character.
    const value = 'é'.repeat(MAX_SUBJECT_PART_LENGTH);

    expect(keyOf({ kind: 'identifier', value })).toMatch(/:identifier:/);
  });

  it('refuses the reserved separator character', () => {
    expect(problemOf({ kind: 'actor', tenantId: 'a\u0000b', actorId: 'c' })).toBe(
      'actor subject contains a reserved character',
    );
  });
});
