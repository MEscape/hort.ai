'use client';

import { Temporal } from 'temporal-polyfill';

import { I18N_CONFIG } from '@i18n';

import { useAppFormatters, useTimeZone } from '@i18n/client';

/** Formats an ISO calendar date (a due date, not an instant) as a long date in the viewer's locale. */
export function useCalendarDateText(): (isoDate: string) => string {
  const format = useAppFormatters();
  const timeZone = useTimeZone() ?? I18N_CONFIG.defaultTimeZone;

  return (isoDate) =>
    format.date(Temporal.PlainDate.from(isoDate).toZonedDateTime(timeZone).epochMilliseconds, {
      dateStyle: 'long',
    });
}
