import 'server-only';

import { IntlErrorCode, type IntlError } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';
import { deepMerge } from '@lib/utils';

import {
  I18N_CONFIG,
  type Locale,
  parseLocale,
  type MessageCatalog,
  getMessageFallback,
} from './config';
import { I18N_ERROR_CODES } from './errors';

const IS_PRODUCTION = serverEnv.NODE_ENV === 'production';

/**
 * Explicit, statically analyzable loader map for each supported locale.
 * Avoids bundler context-module bloat and unsafe `as` casts from template literals.
 */
const LOCALE_LOADERS: Readonly<Record<Locale, () => Promise<{ default: MessageCatalog }>>> = {
  en: () => import('./locales/en'),
  de: () => import('./locales/de'),
};

/**
 * Process-level cache of resolved (and fallback-merged) catalogs for production.
 * Prevents running a full `deepMerge` across 10 namespaces on every single HTTP request.
 */
const catalogCache = new Map<Locale, Promise<MessageCatalog>>();

async function buildLocaleCatalog(locale: Locale): Promise<MessageCatalog> {
  try {
    const loader = LOCALE_LOADERS[locale];
    const { default: messages } = await loader();

    const { defaultLocale } = I18N_CONFIG;
    if (!IS_PRODUCTION || locale === defaultLocale) {
      return messages;
    }

    const { default: defaultMessages } = await LOCALE_LOADERS[defaultLocale]();
    return deepMerge(defaultMessages, messages);
  } catch (error) {
    logger.error('Failed to load locale message catalog', error, {
      module: 'i18n',
      code: I18N_ERROR_CODES.messagesLoadFailed,
      locale,
    });
    throw new Error(`Failed to load messages for locale "${locale}"`, { cause: error });
  }
}

export async function loadRequestMessages(locale: Locale): Promise<MessageCatalog> {
  if (!IS_PRODUCTION) {
    return buildLocaleCatalog(locale);
  }

  const cached = catalogCache.get(locale);
  if (cached) {
    return cached;
  }

  const pending = buildLocaleCatalog(locale).catch((error: unknown) => {
    catalogCache.delete(locale);
    throw error;
  });

  catalogCache.set(locale, pending);
  return pending;
}

export function handleIntlError(error: IntlError): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    logger.warn('Missing translation', {
      module: 'i18n',
      code: I18N_ERROR_CODES.missingMessage,
      detail: error.message,
    });
    return;
  }

  if (error.code === IntlErrorCode.INVALID_KEY) {
    logger.warn('Invalid translation key', {
      module: 'i18n',
      code: I18N_ERROR_CODES.invalidMessageKey,
      detail: error.message,
    });
    return;
  }

  logger.error('Translation runtime error', error, {
    module: 'i18n',
    code: error.code,
  });
}

export default getRequestConfig(
  async (
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- requestLocale is deprecated in favor of next/root-params; migrate together with the Next.js upgrade
    { requestLocale },
  ) => {
    const rawLocale = await requestLocale;
    const locale = parseLocale(rawLocale).unwrapOr(I18N_CONFIG.defaultLocale);

    return {
      locale,
      messages: await loadRequestMessages(locale),
      timeZone: I18N_CONFIG.defaultTimeZone,
      onError: handleIntlError,
      getMessageFallback: (args) => getMessageFallback(args, !IS_PRODUCTION),
    };
  },
);
