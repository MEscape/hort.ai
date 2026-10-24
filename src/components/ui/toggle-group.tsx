'use client';

import * as React from 'react';

import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';

import { cn } from '@lib/utils';

/** shadcn's ToggleGroup root. As `type="multiple"` it is a set of pressable chips (interests). */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('flex flex-wrap gap-3', className)}
      {...props}
    />
  );
}

/**
 * One chip. "Pressed" changes the fill, the boundary AND shows a tick via `data-[state=on]`
 * content in the caller, so the state never rests on colour alone. 48px high, a finger-sized target.
 */
function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'inline-flex min-h-12 items-center gap-2 rounded-token border-2 border-border-strong bg-surface px-4 py-2 text-base font-semibold text-copy',
        'transition-[border-color,background-color,transform] duration-150 ease-soft hover:border-primary-copy active:translate-y-px',
        'data-[state=on]:border-primary-copy data-[state=on]:bg-highlight',
        'disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
