import type { MetadataRoute } from 'next';

import { APP_IDENTITY } from '@lib/config';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_IDENTITY.name,
    short_name: APP_IDENTITY.name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: APP_IDENTITY.colors.background,
    theme_color: APP_IDENTITY.colors.primary,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
