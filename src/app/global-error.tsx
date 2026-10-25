'use client';

// eslint-disable-next-line no-restricted-imports -- the locale-aware `usePathname` of '@i18n' needs the next-intl provider, which this page sits outside of; the raw address is what carries the language
import { usePathname } from 'next/navigation';

import { PageMain } from '@components/layout/layout-primitives';
import { I18nClientProvider } from '@components/providers/i18n-client-provider';
import { RouteErrorPanel } from '@components/shared/route-error-panel';

import { I18N_CONFIG, getDirection, isLocale } from '@i18n';

import deApp from '@i18n/messages/de.json';
import enApp from '@i18n/messages/en.json';

import { fontVariables } from '@lib/fonts';

import './globals.css';

/** Only the texts the panel needs: this page cannot load a catalog from the request. */
const MESSAGES = {
  en: { app: { routeError: enApp.routeError } },
  de: { app: { routeError: deApp.routeError } },
} as const;

/**
 * What the visitor sees when the root layout itself fails, so `error.tsx` cannot render. It replaces
 * the layout, hence its own `<html>`, fonts and styles; there is no request to read the language
 * from, so it comes from the address (`/de/...`). Same panel as every other failure, never the
 * error's own message.
 */
export default function GlobalError({ retry }: { readonly retry: () => void }) {
  const segment = usePathname().split('/')[1];
  const locale = isLocale(segment) ? segment : I18N_CONFIG.defaultLocale;

  return (
    <html
      lang={I18N_CONFIG.definitions[locale].htmlLang}
      dir={getDirection(locale)}
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nClientProvider
          locale={locale}
          messages={MESSAGES[locale]}
          timeZone={I18N_CONFIG.defaultTimeZone}
          isDevelopment={false}
        >
          <PageMain variant="centered">
            <RouteErrorPanel onRetry={retry} />
          </PageMain>
        </I18nClientProvider>
      </body>
    </html>
  );
}
