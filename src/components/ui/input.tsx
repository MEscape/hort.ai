import * as React from 'react';

import { cn } from '@lib/utils';

/**
 * shadcn's Input, in Hortai's tokens: 48px high, a 2px boundary that holds 3:1 against the card
 * and the page, and an invalid state that changes the boundary AND the tint (colour is never the
 * only signal: the field's message carries an icon and words).
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-token border-2 border-border-strong bg-surface px-4 text-base text-copy',
        'placeholder:text-copy-muted selection:bg-primary selection:text-primary-foreground',
        'transition-[border-color,background-color] duration-150 hover:border-primary-copy',
        'aria-invalid:border-danger aria-invalid:bg-danger-subtle',
        'disabled:pointer-events-none disabled:bg-sunken disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
