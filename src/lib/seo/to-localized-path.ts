import type { Locale } from '@i18n';

import { stripTrailingSlash } from '@lib/utils';

/** `pathname` is locale-free and starts with `/`. `('de', '/')` → `/de`. */
export function toLocalizedPath(locale: Locale, pathname: string): string {
  return `/${locale}${stripTrailingSlash(pathname)}`;
}
