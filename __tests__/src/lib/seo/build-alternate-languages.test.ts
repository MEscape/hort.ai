import { describe, expect, it } from 'vitest';

import { I18N_CONFIG } from '@i18n';

import { buildAlternateLanguages } from '@lib/seo/build-alternate-languages';

describe('buildAlternateLanguages', () => {
  it('lists every locale and x-default as the default locale', () => {
    expect(buildAlternateLanguages('/products/1')).toEqual({
      en: '/en/products/1',
      de: '/de/products/1',
      'x-default': `/${I18N_CONFIG.defaultLocale}/products/1`,
    });
  });

  it('handles the root path', () => {
    expect(buildAlternateLanguages('/')).toEqual({
      en: '/en',
      de: '/de',
      'x-default': `/${I18N_CONFIG.defaultLocale}`,
    });
  });
});
