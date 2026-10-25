'use client';

import * as React from 'react';

import { Switch as SwitchPrimitive } from 'radix-ui';

import { cn } from '@lib/utils';

/**
 * shadcn's Switch, in Hortai's tokens. A 56x32px track is a comfortable target; "on" fills the
 * track with the brand colour and moves the thumb, and the row it sits in always says the state in
 * words too, so colour is never the only signal.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-border-strong p-0.5 shadow-soft',
        // The track is 32px; the invisible area around it makes the target 48px high.
        "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
        'transition-[background-color,border-color] duration-150 ease-soft',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:bg-sunken',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-6 rounded-full bg-surface shadow-soft ring-0',
          'transition-transform duration-150 ease-soft data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
