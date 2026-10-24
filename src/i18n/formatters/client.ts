import { useMemo } from 'react';

import { useLocale, useTimeZone } from 'next-intl';

import { I18N_CONFIG } from '../config';

import { createAppFormatters, type AppFormatters } from './app-formatters';

/**
 * The current locale's formatters, for Client Components.
 * Memoized by `locale` and `timeZone` to provide a referentially stable object across renders.
 */
export function useAppFormatters(): AppFormatters {
  const locale = useLocale();
  const timeZone = useTimeZone() ?? I18N_CONFIG.defaultTimeZone;

  return useMemo(() => createAppFormatters(locale, timeZone), [locale, timeZone]);
}
