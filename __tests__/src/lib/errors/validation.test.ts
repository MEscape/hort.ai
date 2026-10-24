import { describe, expect, it } from 'vitest';

import { ROOT_FIELD, fieldPath } from '@lib/errors';

describe('fieldPath', () => {
  it('joins segments with dots', () => {
    expect(fieldPath('children', 0, 'props')).toBe('children.0.props');
  });

  it('returns a single segment unchanged and nothing for no segments', () => {
    expect(fieldPath('name')).toBe('name');
    expect(fieldPath()).toBe('');
  });
});

describe('ROOT_FIELD', () => {
  it('is the key for problems that belong to no field', () => {
    expect(ROOT_FIELD).toBe('_form');
  });
});
