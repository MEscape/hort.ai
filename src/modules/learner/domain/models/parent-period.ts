import { Temporal } from 'temporal-polyfill';

import { LEARNER_TIME_ZONE } from './parent-controls';

const MONTH_DAYS = 30;

/** Calendar boundaries in Berlin, including its 23- and 25-hour days; the current day is partial. */
export function parentPeriod(range: 'today' | 'week' | 'month', now: Date) {
  const today = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO(LEARNER_TIME_ZONE)
    .toPlainDate();
  const from =
    range === 'week'
      ? today.subtract({ days: today.dayOfWeek - 1 })
      : today.subtract({ days: range === 'month' ? MONTH_DAYS - 1 : 0 });
  const days: string[] = [];
  for (
    let date = from;
    Temporal.PlainDate.compare(date, today) <= 0;
    date = date.add({ days: 1 })
  ) {
    days.push(date.toString());
  }
  return {
    range,
    from: from.toZonedDateTime(LEARNER_TIME_ZONE).toInstant().toString(),
    until: now.toISOString(),
    today: today.toString(),
    days,
  };
}

/** A task's recorded start belongs to the Berlin calendar, never the browser's zone. */
export const parentDay = (instant: string): string =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(LEARNER_TIME_ZONE).toPlainDate().toString();
