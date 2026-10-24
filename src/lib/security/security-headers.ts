export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

const HSTS_MAX_AGE_SECONDS = 63_072_000;

/**
 * Directives that need no nonce and so cannot break a script or style:
 * no plugins, no re-pointing of relative URLs, forms post to this site only,
 * and no other site frames this one. A script policy needs a per-request
 * nonce and belongs in `proxy.ts` once the pages can carry one.
 */
const CONTENT_SECURITY_POLICY = [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

/**
 * The headers every response carries (security.md). `Referrer-Policy` keeps a
 * path and query, such as an emailed single-use link, from leaving the site;
 * HSTS is sent in production only, where the site is served over HTTPS.
 */
export function securityHeaders(options: { readonly isProduction: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
  if (options.isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    });
  }
  return headers;
}
