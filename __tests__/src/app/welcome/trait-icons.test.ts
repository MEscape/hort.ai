import { describe, expect, it } from 'vitest';

import { Sparkles } from '@components/ui/icons';

import { traitIconOf } from '@/app/[locale]/(app)/hello/_components/trait-icons';

describe('traitIconOf', () => {
  it('gives every catalog trait its own picture', () => {
    const traits = [
      'treu',
      'energiegeladen',
      'ermutigend',
      'geduldig',
      'sanft',
      'klug',
      'mutig',
      'kreativ',
      'verspielt',
    ];
    const icons = new Set(traits.map(traitIconOf));
    expect(icons.size).toBe(traits.length);
    expect(icons.has(Sparkles)).toBe(false);
  });

  it('falls back to a sparkle for a trait it does not know', () => {
    expect(traitIconOf('unbekannt')).toBe(Sparkles);
  });
});
