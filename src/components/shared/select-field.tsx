import { Label } from '@components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { isDefined } from '@lib/utils';

import { FieldMessage } from './field-message';

export interface SelectFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps {
  readonly id: string;
  /** Always visible: the placeholder is a prompt, never the label. */
  readonly label: string;
  readonly options: readonly SelectFieldOption[];
  /** Shown while nothing is chosen ("Choose a federal state"). */
  readonly placeholder: string;
  /** The chosen value; the empty string while nothing is chosen. */
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly name?: string;
  readonly onBlur?: () => void;
  readonly disabled?: boolean;
  /** The translated mistake, or `undefined` while the field is fine. */
  readonly error?: string | undefined;
  readonly hint?: string;
}

/**
 * A labelled dropdown made of shadcn's Select in Hortai's tokens. The label is tied to the trigger,
 * and the hint and the error are read with it (`aria-describedby`, `aria-invalid`). A controlled
 * component: with `react-hook-form` it is rendered inside a `Controller`.
 */
export function SelectField({
  id,
  label,
  options,
  placeholder,
  value,
  onValueChange,
  name,
  onBlur,
  disabled,
  error,
  hint,
}: SelectFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [isDefined(error) ? errorId : null, isDefined(hint) ? hintId : null]
    .filter(isDefined)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        name={name}
        value={value === '' ? undefined : value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          onBlur={onBlur}
          aria-invalid={isDefined(error) ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldMessage id={errorId}>{error}</FieldMessage>
      <FieldMessage id={hintId} tone="hint">
        {hint}
      </FieldMessage>
    </div>
  );
}
