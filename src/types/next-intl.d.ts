import type { Locale, MessageCatalog } from '../i18n/config';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: MessageCatalog;
  }
}
