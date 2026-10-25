import type { MetadataRoute } from 'next';

import { learnerRoutes } from '@modules/learner';

import { I18N_CONFIG } from '@i18n';

import { toLocalizedPath } from '@lib/seo';

/**
 * Crawlers may read everything except the API and the areas behind sign-in. The sign-in, sign-up and
 * reset pages are deliberately NOT listed: they say `noindex` themselves (`buildPrivateMetadata`), and a
 * crawler that is not allowed to fetch a page never sees that tag, so a blocked URL can still end up
 * in search results. There is no sitemap yet: the only page worth indexing is the welcome page.
 */
export default function robots(): MetadataRoute.Robots {
  const signedInPaths = I18N_CONFIG.locales.flatMap((locale) =>
    [learnerRoutes.home(), learnerRoutes.onboarding()].map((path) => toLocalizedPath(locale, path)),
  );

  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', ...signedInPaths] } };
}
