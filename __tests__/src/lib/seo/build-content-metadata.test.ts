import { describe, expect, it } from 'vitest';

import { buildContentMetadata } from '@lib/seo';

describe('buildContentMetadata', () => {
  const metadata = buildContentMetadata({
    pathname: '/s/springfield/about/',
    title: 'About Springfield',
    description: 'A town.',
    siteName: 'Springfield',
  });

  it('uses an absolute title, since the site is the brand', () => {
    expect(metadata.title).toEqual({ absolute: 'About Springfield' });
    expect(metadata.description).toBe('A town.');
  });

  it('has one canonical URL in the default locale and no language alternates', () => {
    expect(metadata.alternates).toEqual({ canonical: '/en/s/springfield/about' });
  });

  it('names the content site in the social preview', () => {
    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Springfield',
      title: 'About Springfield',
      description: 'A town.',
      url: '/en/s/springfield/about',
    });
  });
});
