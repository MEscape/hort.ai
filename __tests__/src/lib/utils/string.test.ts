import { describe, expect, it } from 'vitest';

import { escapeHtml, isBlank, slugify, trimToNull, truncate } from '@lib/utils';
import { normalizeWhitespace } from '@lib/utils/string';

describe('slugify', () => {
  it.each([
    ['Bürgerbüro & Co.', 'buergerbuero-co'],
    ['Straße', 'strasse'],
    ['Hello World', 'hello-world'],
    ['  --Mixed__Case 42--  ', 'mixed-case-42'],
    ['Café Crème', 'cafe-creme'],
    ['Æther Œuvre Øre Åre Łódź Đa', 'aether-oeuvre-ore-are-lodz-da'],
    ['ÄÖÜ', 'aeoeue'],
  ])('slugify(%j) is %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('')).toBe('');
    expect(slugify('***')).toBe('');
    expect(slugify('日本語')).toBe('');
  });
});

describe('truncate', () => {
  it('returns the text unchanged when it fits', () => {
    expect(truncate('Hello', 5)).toBe('Hello');
    expect(truncate('', 3)).toBe('');
  });

  it('appends an ellipsis that counts toward the limit', () => {
    expect(truncate('Hello world', 8)).toBe('Hello w…');
    expect(truncate('Hello world', 8)).toHaveLength(8);
  });

  it('drops trailing whitespace before the ellipsis', () => {
    expect(truncate('Hello world', 7)).toBe('Hello…');
  });

  it('does not split emoji', () => {
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });

  it('returns the ellipsis alone for a limit of 1, and nothing for 0 or less', () => {
    expect(truncate('abc', 1)).toBe('…');
    expect(truncate('abc', 0)).toBe('');
    expect(truncate('abc', -4)).toBe('');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses runs of whitespace into single spaces and trims', () => {
    expect(normalizeWhitespace('  a \n\t b  c  ')).toBe('a b c');
    expect(normalizeWhitespace('   ')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes the characters significant in markup and attributes', () => {
    expect(escapeHtml('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes the ampersand first so entities are not double-escaped wrongly', () => {
    expect(escapeHtml('a & b &amp;')).toBe('a &amp; b &amp;amp;');
  });

  it('leaves safe text alone', () => {
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});

describe('isBlank', () => {
  it.each([null, undefined, '', '   ', '\n\t '])('is true for %j', (value) => {
    expect(isBlank(value)).toBe(true);
  });

  it.each(['a', ' a ', '0'])('is false for %j', (value) => {
    expect(isBlank(value)).toBe(false);
  });
});

describe('trimToNull', () => {
  it('trims text', () => {
    expect(trimToNull('  a b  ')).toBe('a b');
  });

  it.each([null, undefined, '', '   '])('returns null for %j', (value) => {
    expect(trimToNull(value)).toBeNull();
  });
});
