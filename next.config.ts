import type { NextConfig } from 'next';

import createNextIntlPlugin from 'next-intl/plugin';

import { securityHeaders } from './src/lib/security';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  headers: () =>
    Promise.resolve([
      {
        source: '/:path*',
        headers: securityHeaders({ isProduction: process.env.NODE_ENV === 'production' }),
      },
    ]),
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
