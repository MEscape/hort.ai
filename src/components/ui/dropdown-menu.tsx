'use client';

import * as React from 'react';

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cn } from '@lib/utils';

/**
 * shadcn's DropdownMenu in Hortai's tokens: a menu button with arrow-key navigation, typeahead,
 * Escape and focus return (Radix). Items are at least 44px tall for touch.
 */
function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-56 overflow-hidden rounded-token-lg border-2 border-border bg-surface p-2 text-copy shadow-lift',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn('px-3 py-2 text-sm text-copy-muted', className)}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-token-sm px-3 py-2 text-base outline-hidden select-none',
        'focus:bg-highlight data-[disabled]:pointer-events-none data-[disabled]:opacity-60',
        '[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-copy-muted',
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('-mx-2 my-2 h-px bg-border', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
