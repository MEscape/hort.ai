import { describe, expect, it } from 'vitest';

import { createAppFormatters } from '@i18n/formatters';
import { possessive } from '@i18n/formatters/possessive';

describe('possessive', () => {
  it.each([
    ['Mia', 'Mias'],
    ['Leon', 'Leons'],
    ['Max', "Max'"],
    ['Lars', "Lars'"],
    ['Moritz', "Moritz'"],
    ['Alex', "Alex'"],
    ['Hans-Peter', 'Hans-Peters'],
    ['Strauß', "Strauß'"],
    ['MAX', "MAX'"],
  ])('writes %s as %s in German', (name, expected) => {
    expect(possessive(name, 'de')).toBe(expected);
  });

  it.each([
    ['Mia', "Mia's"],
    ['Max', "Max's"],
    ['James', "James's"],
  ])('writes %s as %s in English', (name, expected) => {
    expect(possessive(name, 'en')).toBe(expected);
  });

  it('ignores whitespace around the name', () => {
    expect(possessive('  Mia ', 'de')).toBe('Mias');
  });

  it('is part of the app formatters of a locale', () => {
    expect(createAppFormatters('de').possessive('Max')).toBe("Max'");
    expect(createAppFormatters('en').possessive('Max')).toBe("Max's");
  });
});
