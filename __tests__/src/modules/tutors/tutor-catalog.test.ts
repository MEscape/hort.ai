import { describe, expect, it } from 'vitest';

import { tutorCatalog, tutorCatalogSchema, tutorImageKey } from '@modules/tutors';

describe('tutor catalog', () => {
  it('parses the shipped tutors.json', () => {
    expect(tutorCatalog.tutoren.map((tutor) => tutor.id)).toEqual(['max', 'lili', 'fina']);
  });

  it('ships the three approved personas as ready', () => {
    expect(tutorCatalog.tutoren.map((tutor) => tutor.status)).toEqual([
      'bereit',
      'bereit',
      'bereit',
    ]);
  });

  it('maps a tutor picture to its storage key', () => {
    expect(tutorImageKey('max', 'mund_zu')).toBe('tutors/max/mund-zu.svg');
    expect(tutorImageKey('max', 'mund_auf')).toBe('tutors/max/mund-auf.svg');
  });

  it('rejects duplicate ids', () => {
    const [first] = tutorCatalog.tutoren;
    const result = tutorCatalogSchema.safeParse({ version: 1, tutoren: [first, first] });
    expect(result.success).toBe(false);
  });

  it('rejects an id with umlauts or capitals', () => {
    const [first] = tutorCatalog.tutoren;
    const result = tutorCatalogSchema.safeParse({
      version: 1,
      tutoren: [{ ...first, id: 'Bär' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const [first] = tutorCatalog.tutoren;
    const result = tutorCatalogSchema.safeParse({ version: 1, tutoren: [{ ...first, extra: 1 }] });
    expect(result.success).toBe(false);
  });
});
