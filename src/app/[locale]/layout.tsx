import React from 'react';

import type { Metadata, Viewport } from 'next';

import { I18nProvider } from '@components/providers/i18n-provider';

import { I18N_CONFIG, getDirection, requireLocale } from '@i18n';

import { setRequestLocale } from '@i18n/server';

import { APP_IDENTITY, publicEnv } from '@lib/config';
import { fontVariables } from '@lib/fonts';

import '../globals.css';

/*
 * Static on purpose. A translated, per-request `generateMetadata` here would
 * read route params for EVERY route below, including the catch-all whose
 * fallback shell cannot resolve them. Pages own their title and description
 * through `lib/seo`; this only sets what is the same everywhere.
 */
export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  applicationName: APP_IDENTITY.name,
  title: { template: `%s | ${APP_IDENTITY.name}`, default: APP_IDENTITY.name },
  twitter: { card: 'summary' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: APP_IDENTITY.colors.primary,
  colorScheme: 'light',
};

export function generateStaticParams() {
  return I18N_CONFIG.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  /** The raw URL segment: only `requireLocale` turns it into a `Locale` (or a 404). */
  params: Promise<{ locale: string }>;
}) {
  const locale = requireLocale((await params).locale);
  // Tells next-intl the locale without reading request headers, which would make the whole tree dynamic.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- migrate to next/root-params together with i18n/request.ts
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
