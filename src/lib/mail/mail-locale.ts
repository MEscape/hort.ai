import { parseLocale, I18N_CONFIG } from '@i18n';
import type { Locale } from '@i18n';

import { getLocale } from '@i18n/server';

/**
 * Resolves the mail locale from the active request at send-time.
 *
 * next-intl's `getLocale` reads the negotiated locale from the request
 * context on the server, so the language of an email follows the visitor's
 * language with no extra configuration. Falls back to the default locale
 * outside a request (a cron job, a background task) or for an unsupported one.
 */
export async function resolveMailLocale(): Promise<Locale> {
  try {
    return parseLocale(await getLocale()).unwrapOr(I18N_CONFIG.defaultLocale);
  } catch {
    // getLocale() throws if called outside a Next.js request context.
    return I18N_CONFIG.defaultLocale;
  }
}
