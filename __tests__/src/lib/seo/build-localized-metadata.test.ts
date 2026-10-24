import { describe, expect, it } from 'vitest';

import { APP_IDENTITY } from '@lib/config';
import { buildLocalizedMetadata } from '@lib/seo';

describe('buildLocalizedMetadata', () => {
  it('describes a page in its own locale with the others as alternates', () => {
    expect(
      buildLocalizedMetadata({
        locale: 'de',
        pathname: '/about',
        title: 'Über uns',
        description: 'Wer wir sind',
      }),
    ).toEqual({
      title: 'Über uns',
      description: 'Wer wir sind',
      alternates: {
        canonical: '/de/about',
        languages: { en: '/en/about', de: '/de/about', 'x-default': '/en/about' },
      },
      openGraph: {
        type: 'website',
        siteName: APP_IDENTITY.name,
        title: 'Über uns',
        description: 'Wer wir sind',
        url: '/de/about',
        locale: 'de_DE',
        alternateLocale: ['en_US'],
      },
    });
  });

  it('swaps the Open Graph locales for the other language', () => {
    const { openGraph } = buildLocalizedMetadata({
      locale: 'en',
      pathname: '/',
      title: 'Home',
      description: 'Welcome',
    });

    expect(openGraph).toMatchObject({ url: '/en', locale: 'en_US', alternateLocale: ['de_DE'] });
  });
});
