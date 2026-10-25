import { useId } from 'react';
import type { ReactNode } from 'react';

export interface SettingsGroupProps {
  readonly title: string;
  readonly description?: string;
  /** The rows of the group. Each row brings its own padding; the group draws the lines between them. */
  readonly children: ReactNode;
}

/**
 * One topic of the parent controls: a heading, one calm sentence, and the rows that belong to it in
 * a single bordered list with a line between the rows. One level only: no boxes inside boxes, no
 * icon tiles, so the eye reads headings first and rows second.
 */
export function SettingsGroup({ title, description, children }: SettingsGroupProps) {
  const id = useId();

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-heading`} className="font-heading text-xl font-semibold text-copy">
          {title}
        </h2>
        {description !== undefined && <p className="text-copy-muted">{description}</p>}
      </div>
      <div className="divide-y divide-border rounded-token-lg border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}
