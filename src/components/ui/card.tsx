import * as React from 'react';

import { cn } from '@lib/utils';

/**
 * shadcn's Card, as Hortai's "storybook page": a white surface on the world, large radius, soft
 * lift. The one container for a screen's main content; never nest cards inside cards.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'relative flex flex-col rounded-token-xl border border-border bg-surface text-copy shadow-lift',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="card-header"
      className={cn('flex flex-col items-center gap-3 px-6 pt-8 text-center sm:px-10', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('flex flex-col gap-6 px-6 py-6 sm:px-10', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'footer'>) {
  return (
    <footer
      data-slot="card-footer"
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-b-token-xl border-t border-border bg-highlight/60 px-6 py-5 text-center text-base text-copy-muted sm:px-10',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardContent, CardFooter, CardHeader };
