import type { ComponentProps, ReactNode } from 'react';

import { CircleCheck } from '@components/ui/icons';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';

import { cn, isDefined } from '@lib/utils';

import { FieldMessage } from './field-message';

export interface TextFieldProps extends Omit<ComponentProps<typeof Input>, 'id'> {
  readonly id: string;
  /** Always visible: a placeholder is an example, never the label. */
  readonly label: string;
  /** The translated mistake, or `undefined` while the field is fine. */
  readonly error?: string | undefined;
  readonly hint?: string;
  /** Show a tick: the person has been here and the value is right. */
  readonly isValid?: boolean;
  /** Something beside the label, such as "Forgot your password?". */
  readonly labelAction?: ReactNode;
  /** A control inside the field's right edge (the password toggle). */
  readonly trailing?: ReactNode;
  /** Help under the field (strength, rules). Give it an id and pass the id as `guidanceId`. */
  readonly children?: ReactNode;
  readonly guidanceId?: string | undefined;
}

/**
 * A labelled field with its hint and error wired the way assistive technology needs: the label is
 * tied to the input, the error and hint are read with it (`aria-describedby`), and `aria-invalid`
 * marks the field. Works with `react-hook-form`'s `register` (the ref arrives as a prop).
 */
export function TextField({
  id,
  label,
  error,
  hint,
  isValid = false,
  labelAction,
  trailing,
  children,
  guidanceId,
  className,
  ...inputProps
}: TextFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [
    isDefined(error) ? errorId : null,
    isDefined(hint) ? hintId : null,
    guidanceId ?? null,
  ]
    .filter(isDefined)
    .join(' ');
  const hasTrailing = trailing !== undefined || isValid;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          aria-invalid={isDefined(error) ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={cn(hasTrailing && 'pr-12', className)}
          {...inputProps}
        />
        {trailing === undefined && isValid && (
          <CircleCheck
            className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-success"
            aria-hidden="true"
          />
        )}
        {trailing !== undefined && (
          <div className="absolute top-1/2 right-1 -translate-y-1/2">{trailing}</div>
        )}
      </div>
      <FieldMessage id={errorId}>{error}</FieldMessage>
      <FieldMessage id={hintId} tone="hint">
        {hint}
      </FieldMessage>
      {children}
    </div>
  );
}
