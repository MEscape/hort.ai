'use client';

import * as React from 'react';

import { Label as LabelPrimitive } from 'radix-ui';

import { cn } from '@lib/utils';

/** A visible label above its field: never a placeholder standing in for one. */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-base leading-snug font-semibold text-copy select-none',
        'peer-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
