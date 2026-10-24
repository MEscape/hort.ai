import { describe, expect, it } from 'vitest';

import { OBJECT_VISIBILITIES } from '@lib/storage/object-store';

describe('OBJECT_VISIBILITIES', () => {
  it('names exactly the two places an object can live', () => {
    expect([...OBJECT_VISIBILITIES]).toEqual(['public', 'private']);
  });
});
