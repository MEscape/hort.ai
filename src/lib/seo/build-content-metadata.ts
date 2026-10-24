import type { Metadata } from 'next';

import { I18N_CONFIG } from '@i18n';

import { toLocalizedPath } from './to-localized-path';

interface ContentMetadataOptions {
  /** Locale-free path, e.g. `/s/springfield/about`. */
  readonly pathname: string;
  readonly title: string;
  readonly description: string;
  /** The name of the site the content belongs to, e.g. a published site's title. */
  readonly siteName: string;
}

/**
 * Metadata for content that is NOT translated, like a published site's pages:
 * `/en/...` and `/de/...` show the same text, so claiming them as language
 * alternates (what `buildLocalizedMetadata` does) would mislead search
 * engines. One canonical URL, in the default locale, collects them all.
 *
 * The title is absolute: the site's name is the brand here, not HortAi's.
 */
export function buildContentMetadata({
  pathname,
  title,
  description,
  siteName,
}: ContentMetadataOptions): Metadata {
  const canonical = toLocalizedPath(I18N_CONFIG.defaultLocale, pathname);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: 'website', siteName, title, description, url: canonical },
  };
}
