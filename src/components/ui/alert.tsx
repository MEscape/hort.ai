import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@lib/utils';

/**
 * shadcn's Alert with Hortai's feedback palette. Each variant is a subtle fill, a visible
 * border and a solid icon colour; the words stay in the body colour so they always read.
 *
 * - `nudge`, `hint`, `success`: what a CHILD sees ("Almost! Let's try another way").
 * - `info`, `warning`, `danger`: system messages for the parent area.
 * A form that was refused is a nudge, not an error: the person did nothing wrong.
 */
const alertVariants = cva(
  [
    'relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-token-lg border-2 px-4 py-3',
    'text-base leading-snug text-copy [&>svg]:mt-0.5 [&>svg]:size-5',
  ],
  {
    variants: {
      variant: {
        info: 'border-info-border bg-info-subtle [&>svg]:text-info',
        success: 'border-success-border bg-success-subtle [&>svg]:text-success',
        nudge: 'border-nudge-border bg-nudge-subtle [&>svg]:text-nudge',
        hint: 'border-hint-border bg-hint-subtle [&>svg]:text-hint',
        warning: 'border-warning-border bg-warning-subtle [&>svg]:text-warning',
        danger: 'border-danger-border bg-danger-subtle [&>svg]:text-danger',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

type AlertProps = React.ComponentProps<'div'> & VariantProps<typeof alertVariants>;

/** `role="alert"` interrupts a screen reader: pass `role="status"` for news that can wait. */
function Alert({ className, variant, role = 'alert', ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 font-heading font-semibold', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('col-start-2 grid justify-items-start gap-1 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
