import { describe, expect, it } from 'vitest';

import { buildPrivateMetadata } from '@lib/seo';

describe('buildPrivateMetadata', () => {
  it('carries a title and noindex, and nothing that advertises the page', () => {
    expect(buildPrivateMetadata('Sign in')).toEqual({
      title: 'Sign in',
      robots: { index: false, follow: false },
    });
  });
});
