import { useId } from 'react';

import { useAppFormatters } from '@i18n/client';

const PERCENT = 100;

/**
 * Counts have visible labels and a shared zero baseline. The figure's list is its text equivalent.
 * `maximum` is the bar's full length: the denominator when each row is a share of the same tasks.
 */
export function ParentBars({
  title,
  description,
  scope,
  rows,
  maximum,
}: {
  readonly title: string;
  readonly description: string;
  readonly scope: string;
  readonly rows: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly maximum?: number;
}) {
  const id = useId();
  const format = useAppFormatters();
  const full = Math.max(1, maximum ?? 0, ...rows.map((row) => row.value));
  return (
    <figure aria-labelledby={id} className="min-w-0">
      <figcaption>
        <h2 id={id} className="font-heading text-2xl font-medium">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-copy-muted">{description}</p>
        <p className="mt-2 text-xs text-copy-muted">{scope}</p>
      </figcaption>
      <ul className="mt-6 space-y-4">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 break-words">{row.label}</span>
              <span className="font-semibold tabular-nums">{format.number(row.value)}</span>
            </div>
            <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${(row.value / full) * PERCENT}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
