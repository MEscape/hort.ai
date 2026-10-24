import 'server-only';

import { getLocale, getTimeZone } from 'next-intl/server';

import { I18N_CONFIG } from '../config';

import { createAppFormatters, type AppFormatters } from './app-formatters';

/** The request's formatters, for Server Components. */
export async function getAppFormatters(): Promise<AppFormatters> {
  const [locale, timeZone] = await Promise.all([getLocale(), getTimeZone()]);
  return createAppFormatters(locale, timeZone || I18N_CONFIG.defaultTimeZone);
}
