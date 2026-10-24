import { describe, expect, it } from 'vitest';

import { cn } from '@lib/utils';

describe('cn', () => {
  it('joins class names and drops falsy ones', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('keeps the last of conflicting Tailwind utilities', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
