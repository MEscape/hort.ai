import type { ReactNode } from 'react';

export interface SettingRowProps {
  /** Ties the text to the control it describes (`aria-labelledby` / `aria-describedby`). */
  readonly titleId: string;
  readonly descriptionId: string;
  readonly title: string;
  readonly description: string;
  /** The state said in words ("Voice is on"), because a switch alone is colour and position. */
  readonly stateText?: string;
  /** The control itself: a switch. */
  readonly children: ReactNode;
}

/**
 * One setting: what it is and what it does on the left, its state in words and the control on the
 * right. The same row for every switch, so the parent learns the pattern once. On a phone the control
 * sits under the text so the words keep the full width. No icon, no colour: the words carry it.
 */
export function SettingRow({
  titleId,
  descriptionId,
  title,
  description,
  stateText,
  children,
}: SettingRowProps) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p id={titleId} className="font-semibold text-copy">
          {title}
        </p>
        <p id={descriptionId} className="text-copy-muted">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:w-44 sm:justify-end">
        {stateText !== undefined && (
          <span className="text-sm font-semibold text-copy-muted sm:text-right">{stateText}</span>
        )}
        {children}
      </div>
    </div>
  );
}
