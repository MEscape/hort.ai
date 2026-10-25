import { describe, expect, it } from 'vitest';

import {
  RETURN_PATH_MAX_LENGTH,
  resolveReturnPath,
} from '@modules/auth/presentation/navigation/return-path';
import { parseSettingsPageParams } from '@modules/auth/presentation/schemas/page-params-schema';

describe('safe post-login navigation', () => {
  it.each([
    undefined,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/\t/evil.test',
    'javascript:alert(1)',
    '/'.repeat(RETURN_PATH_MAX_LENGTH + 1),
  ])('rejects an unsafe return path (%s)', (raw) => {
    expect(resolveReturnPath(raw)).toBe('/home');
  });

  it('preserves a same-site path and query, normalizes traversal, and drops fragments', () => {
    expect(resolveReturnPath('/home?tab=family#heading')).toBe('/home?tab=family');
    expect(resolveReturnPath('/a/../home')).toBe('/home');
    expect(resolveReturnPath('/de/home')).toBe('/de/home');
  });
});

describe('settings back arrow', () => {
  it.each([
    [{ returnTo: '/teacher/assignments?classroom=abc' }, '/teacher/assignments?classroom=abc'],
    [{ returnTo: '//evil.test' }, '/home'],
    [{ returnTo: '/settings?returnTo=/home' }, '/home'],
    [{ returnTo: ['/a', '/b'] }, '/home'],
    [{}, '/home'],
  ])('leads from %j to %s', (raw, expected) => {
    expect(parseSettingsPageParams(raw).backHref).toBe(expected);
  });
});
