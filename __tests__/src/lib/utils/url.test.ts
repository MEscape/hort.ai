import { describe, expect, it } from 'vitest';

import {
  buildQueryString,
  isRelativePath,
  isValidUrl,
  joinPath,
  stripTrailingSlash,
} from '@lib/utils';

describe('isValidUrl', () => {
  it('accepts http and https URLs by default', () => {
    expect(isValidUrl('https://example.org')).toBe(true);
    expect(isValidUrl('http://example.org/path?q=1')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    'ftp://example.org',
    'file:///etc/passwd',
  ])('refuses %s', (value) => {
    expect(isValidUrl(value)).toBe(false);
  });

  it.each(['', 'not a url', '/relative/path', '//example.org'])(
    'refuses the non-URL %j',
    (value) => {
      expect(isValidUrl(value)).toBe(false);
    },
  );

  it('honours a custom protocol allowlist', () => {
    expect(isValidUrl('mailto:a@example.org', ['mailto:'])).toBe(true);
    expect(isValidUrl('https://example.org', ['mailto:'])).toBe(false);
    expect(isValidUrl('https://example.org', [])).toBe(false);
  });
});

describe('isRelativePath', () => {
  it.each(['/', '/news', '/news?page=2', '/a/b#frag', '/a%20b'])('accepts %s', (value) => {
    expect(isRelativePath(value)).toBe(true);
  });

  it.each([
    ['empty string', ''],
    ['no leading slash', 'news'],
    ['absolute URL', 'https://evil.com'],
    ['protocol-relative', '//evil.com'],
    ['backslash', '/\\evil.com'],
    ['backslash anywhere', '/a\\b'],
    ['tab hidden protocol-relative', '/\t/evil.com'],
    ['newline hidden protocol-relative', '/\n/evil.com'],
    ['carriage return hidden', '/\r/evil.com'],
    ['javascript scheme', 'javascript:alert(1)'],
  ])('refuses %s', (_label, value) => {
    expect(isRelativePath(value)).toBe(false);
  });
});

describe('stripTrailingSlash', () => {
  it.each([
    ['/a//', '/a'],
    ['/a', '/a'],
    ['/a/b/', '/a/b'],
    ['///', ''],
    ['/', ''],
    ['', ''],
  ])('stripTrailingSlash(%j) is %j', (input, expected) => {
    expect(stripTrailingSlash(input)).toBe(expected);
  });

  it('keeps slashes inside the string and is fast on a long run of them', () => {
    const run = '/'.repeat(200_000);
    const started = performance.now();
    expect(stripTrailingSlash(`a${run}b${run}`)).toBe(`a${run}b`);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('joinPath', () => {
  it('joins segments with single slashes into an absolute path', () => {
    expect(joinPath('/a/', '/b', '', 'c/')).toBe('/a/b/c');
    expect(joinPath('a', 'b')).toBe('/a/b');
    expect(joinPath('//a//', '///b///')).toBe('/a/b');
  });

  it('returns the root for no usable segments', () => {
    expect(joinPath()).toBe('/');
    expect(joinPath('', '/', '//')).toBe('/');
  });

  it('keeps inner structure and does not encode or resolve segments', () => {
    expect(joinPath('a/b', 'c d')).toBe('/a/b/c d');
    expect(joinPath('a', '..', 'b')).toBe('/a/../b');
  });
});

describe('buildQueryString', () => {
  it('builds a query string with a leading ?, skipping undefined and null', () => {
    expect(buildQueryString({ page: 2, q: undefined, n: null })).toBe('?page=2');
  });

  it('repeats the key for arrays', () => {
    expect(buildQueryString({ page: 2, tag: ['a', 'b'], q: undefined })).toBe(
      '?page=2&tag=a&tag=b',
    );
    expect(buildQueryString({ n: [1, 2], f: [true] })).toBe('?n=1&n=2&f=true');
  });

  it('keeps falsy values that are defined', () => {
    expect(buildQueryString({ n: 0, f: false, s: '' })).toBe('?n=0&f=false&s=');
  });

  it('percent-encodes keys and values', () => {
    expect(buildQueryString({ 'a b': 'x&y=z', q: 'ä/?' })).toBe('?a+b=x%26y%3Dz&q=%C3%A4%2F%3F');
  });

  it('is empty when nothing remains', () => {
    expect(buildQueryString({})).toBe('');
    expect(buildQueryString({ a: undefined, b: null, c: [] })).toBe('');
  });

  it('keeps a __proto__ key as an ordinary parameter', () => {
    const params: Record<string, string> = JSON.parse('{"__proto__": "x"}');
    expect(buildQueryString(params)).toBe('?__proto__=x');
  });
});
