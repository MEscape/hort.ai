import type { ComponentProps } from 'react';

import { cn, isDefined } from '@lib/utils';

import { FieldMessage } from './field-message';

export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  /** One short line under the label, for a choice that needs a reason. */
  readonly description?: string;
}

export interface ChoiceGroupProps {
  readonly id: string;
  /** The question, always visible; it is the group's accessible name. */
  readonly legend: string;
  readonly options: readonly ChoiceOption[];
  /** Spread from `react-hook-form`'s `register`: name, ref, onChange and onBlur. */
  readonly radioProps: Omit<ComponentProps<'input'>, 'type' | 'value' | 'id'>;
  /** The translated mistake, or `undefined` while the group is fine. */
  readonly error?: string | undefined;
  readonly hint?: string;
  /** Lay the choices side by side when they are short (a school grade). */
  readonly isCompact?: boolean;
}

/**
 * A few big, touch-friendly choices where exactly one is picked. Native radio buttons keep arrow-key
 * movement and screen-reader grouping; the whole card is the target. The chosen card changes its
 * border and fill AND shows a dot, so colour is never the only signal.
 */
export function ChoiceGroup({
  id,
  legend,
  options,
  radioProps,
  error,
  hint,
  isCompact = false,
}: ChoiceGroupProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [isDefined(error) ? errorId : null, isDefined(hint) ? hintId : null]
    .filter(isDefined)
    .join(' ');

  return (
    <fieldset
      aria-describedby={describedBy === '' ? undefined : describedBy}
      className="flex min-w-0 flex-col gap-2"
    >
      <legend className="mb-2 text-base leading-snug font-semibold text-copy">{legend}</legend>
      <div className={cn('grid gap-3', isCompact ? 'grid-cols-2' : 'grid-cols-1')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-14 cursor-pointer items-start gap-3 rounded-token border-2 border-border-strong bg-surface px-4 py-3',
              'transition-[border-color,background-color] duration-150 hover:border-primary-copy',
              'has-checked:border-primary-copy has-checked:bg-highlight has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-copy',
              'has-disabled:pointer-events-none has-disabled:opacity-60',
              isCompact && 'items-center justify-center text-center',
            )}
          >
            <input
              type="radio"
              value={option.value}
              className="peer size-5 shrink-0 accent-primary focus-visible:outline-none!"
              {...radioProps}
            />
            <span className="flex flex-col">
              <span className="font-semibold text-copy">{option.label}</span>
              {option.description !== undefined && (
                <span className="text-copy-muted">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <FieldMessage id={errorId}>{error}</FieldMessage>
      <FieldMessage id={hintId} tone="hint">
        {hint}
      </FieldMessage>
    </fieldset>
  );
}
