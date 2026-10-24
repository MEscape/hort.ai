import type { ComponentProps } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Label } from '@components/ui/label';

interface AssignmentTextAreaProps extends ComponentProps<'textarea'> {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly error?: string | undefined;
}

// @ui-plain textarea No shared Textarea exists; compose the existing Label and FieldMessage here.
export function AssignmentTextArea({ id, label, hint, error, ...props }: AssignmentTextAreaProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={`${id}-hint ${id}-error`}
        className="min-h-32 w-full resize-y rounded-token border-2 border-border-strong bg-surface px-4 py-3 text-base text-copy transition-colors placeholder:text-copy-muted hover:border-primary-copy aria-invalid:border-danger aria-invalid:bg-danger-subtle disabled:opacity-60"
        {...props}
      />
      <FieldMessage id={`${id}-hint`} tone="hint">
        {hint}
      </FieldMessage>
      <FieldMessage id={`${id}-error`}>{error}</FieldMessage>
    </div>
  );
}
