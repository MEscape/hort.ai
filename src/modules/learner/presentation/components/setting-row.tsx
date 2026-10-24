import type { ComponentType, ReactNode } from 'react';

import type { IconProps } from '@components/ui/icons';

export interface SettingRowProps {
  readonly icon: ComponentType<IconProps>;
  /** Ties the text to the control it describes (`aria-labelledby` / `aria-describedby`). */
  readonly titleId: string;
  readonly descriptionId: string;
  readonly title: string;
  readonly description: string;
  /** The state said in words ("Voice is on"), because a switch alone is colour and position. */
  readonly stateText: string;
  /** The control itself: a switch. */
  readonly children: ReactNode;
}

/**
 * One setting in the parent controls: an icon tile, what it is, what it does, and the switch with
 * its state in words. The same row for every switch, so the parent learns the pattern once. On a
 * phone the switch and its state sit under the text, so the words keep the full width; from `sm`
 * they sit in a column on the right, aligned across rows.
 */
export function SettingRow({
  icon: Icon,
  titleId,
  descriptionId,
  title,
  description,
  stateText,
  children,
}: SettingRowProps) {
  return (
    <div className="flex flex-col gap-3 rounded-token-lg border border-border bg-surface p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-start sm:gap-4">
        <span
          aria-hidden="true"
          className="hidden size-11 shrink-0 items-center justify-center rounded-token bg-secondary text-secondary-foreground sm:flex"
        >
          <Icon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p
            id={titleId}
            className="flex items-center gap-3 font-heading text-lg font-semibold text-copy"
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-token bg-secondary text-secondary-foreground sm:hidden"
            >
              <Icon className="size-5" />
            </span>
            {title}
          </p>
          <p id={descriptionId} className="text-copy-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:w-32 sm:flex-col sm:items-end sm:gap-1">
        {children}
        <span className="text-sm font-semibold text-copy-muted sm:text-right">{stateText}</span>
      </div>
    </div>
  );
}
