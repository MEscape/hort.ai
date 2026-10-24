'use client';

import * as React from 'react';

import { Checkbox as CheckboxPrimitive } from 'radix-ui';

import { Check } from '@components/ui/icons';

import { cn } from '@lib/utils';

/** shadcn's Checkbox, in Hortai's tokens: a 24px box with a 2px boundary that holds 3:1 contrast. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-6 shrink-0 rounded-token-sm border-2 border-border-strong bg-surface',
        'transition-[border-color,background-color] duration-150 hover:border-primary-copy',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'aria-invalid:border-danger aria-invalid:bg-danger-subtle',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
      >
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
