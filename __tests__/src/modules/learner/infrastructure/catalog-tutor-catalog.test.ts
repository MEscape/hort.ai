import { describe, expect, it } from 'vitest';

import { toTutorId } from '@modules/learner/domain/models/ids';
import { createCatalogTutors } from '@modules/learner/infrastructure/tutors/catalog-tutor-catalog';
import { tutorCatalog } from '@modules/tutors';

describe('the tutor catalog port', () => {
  const tutors = createCatalogTutors();

  it.each(['max', 'lili', 'fina'])('offers the ready tutor %s', (id) => {
    expect(tutors.isSelectable(toTutorId(id))).toBe(true);
  });

  it.each(['', 'unknown', 'MAX', ' max', 'max ', 'ma'])('refuses the id %j', (id) => {
    expect(tutors.isSelectable(toTutorId(id))).toBe(false);
  });

  it('refuses a tutor that is still a draft', () => {
    const [first, ...rest] = tutorCatalog.tutoren;
    if (first === undefined) {
      throw new Error('the checked-in catalog is empty');
    }
    const withDraft = {
      ...tutorCatalog,
      tutoren: [{ ...first, status: 'entwurf' as const }, ...rest],
    };

    const draftTutors = createCatalogTutors(withDraft);

    expect(draftTutors.isSelectable(toTutorId(first.id))).toBe(false);
    expect(draftTutors.isSelectable(toTutorId('lili'))).toBe(true);
  });
});
