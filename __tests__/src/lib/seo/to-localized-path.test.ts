import { describe, expect, it } from 'vitest';

import { toLocalizedPath } from '@lib/seo';

describe('toLocalizedPath', () => {
  it('prefixes the locale', () => {
    expect(toLocalizedPath('de', '/products/123')).toBe('/de/products/123');
    expect(toLocalizedPath('en', '/products/123')).toBe('/en/products/123');
  });

  it('maps the root to the bare locale', () => {
    expect(toLocalizedPath('de', '/')).toBe('/de');
  });

  it('drops a trailing slash', () => {
    expect(toLocalizedPath('en', '/about/')).toBe('/en/about');
  });
});
