import { I18N_CONFIG } from '@i18n';

import { toLocalizedPath } from './to-localized-path';

/** hreflang map including `x-default` (the default locale). Every page must list itself and all its siblings. */
export function buildAlternateLanguages(pathname: string): Record<string, string> {
  return {
    ...Object.fromEntries(
      I18N_CONFIG.locales.map((locale) => [locale, toLocalizedPath(locale, pathname)]),
    ),
    'x-default': toLocalizedPath(I18N_CONFIG.defaultLocale, pathname),
  };
}
