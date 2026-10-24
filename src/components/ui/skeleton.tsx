import * as React from 'react';

import { cn } from '@lib/utils';

/** A quiet placeholder while content loads: the sunken tone, pulsing only when motion is welcome. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-token bg-sunken', className)}
      {...props}
    />
  );
}

export { Skeleton };
