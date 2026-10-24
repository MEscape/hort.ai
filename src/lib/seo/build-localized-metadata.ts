import type { Metadata } from 'next';

import { I18N_CONFIG, type Locale } from '@i18n';

import { APP_IDENTITY } from '@lib/config';

import { buildAlternateLanguages } from './build-alternate-languages';
import { toLocalizedPath } from './to-localized-path';

interface LocalizedMetadataOptions {
  readonly locale: Locale;
  /** Locale-free path, e.g. `/products/123`. */
  readonly pathname: string;
  readonly title: string;
  readonly description: string;
}

/** Relative URLs resolve against `metadataBase` set in the root layout. */
export function buildLocalizedMetadata({
  locale,
  pathname,
  title,
  description,
}: LocalizedMetadataOptions): Metadata {
  const canonical = toLocalizedPath(locale, pathname);

  return {
    title,
    description,
    alternates: { canonical, languages: buildAlternateLanguages(pathname) },
    openGraph: {
      type: 'website',
      siteName: APP_IDENTITY.name,
      title,
      description,
      url: canonical,
      locale: I18N_CONFIG.definitions[locale].openGraphLocale,
      alternateLocale: I18N_CONFIG.locales
        .filter((other) => other !== locale)
        .map((other) => I18N_CONFIG.definitions[other].openGraphLocale),
    },
  };
}
