import { useId } from 'react';

import { useAppFormatters, useTranslations } from '@i18n/client';

import type {
  ParentLearningMetrics,
  ParentPeriod,
} from '../../application/contracts/parent-learning-views';

const SERIES = [
  { status: 'COMPLETED', color: 'bg-chart-2' },
  { status: 'ACTIVE', color: 'bg-chart-1' },
  { status: 'ABANDONED', color: 'bg-chart-5' },
] as const;
const PERCENTAGE = 100;

// @ui-plain table The figure owns its compact data equivalent; this repository has no Table primitive.
/** Current outcomes by start day. The table is available without hover, scripting or color perception. */
export function ParentOutcomes({
  metrics,
  period,
}: {
  readonly metrics: ParentLearningMetrics;
  readonly period: ParentPeriod;
}) {
  const t = useTranslations('learner.dashboard');
  const format = useAppFormatters();
  const id = useId();
  const maximum = Math.max(
    1,
    ...metrics.outcomes.map((row) => row.ACTIVE + row.COMPLETED + row.ABANDONED),
  );
  return (
    <figure aria-labelledby={id}>
      <figcaption>
        <h2 id={id} className="font-heading text-2xl font-medium">
          {t('outcomesTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-copy-muted">{t('outcomesDescription')}</p>
        <p className="mt-2 text-xs text-copy-muted">
          {t('period', { from: format.date(period.from), until: format.date(period.until) })}
        </p>
      </figcaption>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {SERIES.map(({ status, color }) => (
          <span key={status} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 rounded-sm ${color}`} />
            {t(`status.${status}`)}
          </span>
        ))}
      </div>
      <div className="mt-6 space-y-3" aria-hidden="true">
        {metrics.outcomes.map((row) => (
          <div key={row.day} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs tabular-nums text-copy-muted">
              {format.date(`${row.day}T12:00:00Z`, { day: 'numeric', month: 'numeric' })}
            </span>
            <div className="flex h-5 flex-1 overflow-hidden rounded-sm bg-sunken/50">
              {SERIES.map(({ status, color }) => (
                <span
                  key={status}
                  className={color}
                  style={{ width: `${(row[status] / maximum) * PERCENTAGE}%` }}
                />
              ))}
            </div>
            <span className="w-6 text-right text-sm tabular-nums">
              {format.number(row.ACTIVE + row.COMPLETED + row.ABANDONED)}
            </span>
          </div>
        ))}
      </div>
      <details className="mt-5">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-primary-copy">
          {t('tableSummary')}
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t('outcomesDescription')}</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2">
                  {t('day')}
                </th>
                {SERIES.map(({ status }) => (
                  <th key={status} scope="col" className="p-2">
                    {t(`status.${status}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.outcomes.map((row) => (
                <tr key={row.day} className="border-t border-border">
                  <th scope="row" className="p-2 font-normal">
                    {format.date(`${row.day}T12:00:00Z`)}
                  </th>
                  {SERIES.map(({ status }) => (
                    <td key={status} className="p-2 tabular-nums">
                      {format.number(row[status])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
