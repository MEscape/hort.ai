import { describe, expect, it } from 'vitest';

import { hasExceededMaxLifetime } from '@modules/auth/domain/models/session-policy';

const CREATED = new Date('2026-01-01T00:00:00.000Z');
const LIFETIME_MS = 1000;

describe('hasExceededMaxLifetime', () => {
  it('keeps a session alive until its ceiling', () => {
    const now = new Date(CREATED.getTime() + LIFETIME_MS - 1);

    expect(hasExceededMaxLifetime(CREATED, now, LIFETIME_MS)).toBe(false);
  });

  it('ends it exactly at the ceiling, however recently it was extended', () => {
    const now = new Date(CREATED.getTime() + LIFETIME_MS);

    expect(hasExceededMaxLifetime(CREATED, now, LIFETIME_MS)).toBe(true);
  });
});
