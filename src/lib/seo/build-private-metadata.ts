import type { Metadata } from 'next';

/**
 * Metadata of a page that must never be indexed: one behind sign-in, or one
 * reached only through a single-use emailed link. A canonical URL or social
 * preview would only advertise it, so unlike `buildLocalizedMetadata` this
 * carries just a title and `noindex`.
 */
export function buildPrivateMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
