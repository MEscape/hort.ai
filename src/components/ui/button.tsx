import * as React from 'react';

import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@lib/utils';

/**
 * shadcn's Button, dressed in Hortai's tokens. Sizes start at 48px high: a button must be easy to
 * hit for a parent holding a toddler and for a child's finger. The focus ring is the global
 * `:focus-visible` rule, so none is added here.
 *
 * - `default`: the one main action of a screen (chestnut brown).
 * - `accent`: a moment of discovery or arrival (owl amber), used at most once per screen.
 * - `secondary`: calm, reassuring actions (book blue).
 * - `outline`: the second choice next to a main action.
 * - `ghost` / `link`: quiet actions inside text and toolbars.
 * - `danger`: destructive actions in the parent area, never for a child's mistake.
 */
const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 font-heading font-semibold whitespace-nowrap',
    'rounded-token transition-[background-color,box-shadow,transform] duration-150 ease-soft',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-60',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90',
        accent: 'bg-accent text-accent-foreground shadow-soft hover:bg-accent/90',
        secondary: 'bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/90',
        outline: 'border-2 border-border-strong bg-surface text-copy hover:bg-highlight',
        ghost: 'text-primary-copy hover:bg-highlight',
        link: 'h-auto rounded-token-sm px-0 text-primary-copy underline underline-offset-4 hover:text-copy',
        danger: 'bg-danger text-status-foreground shadow-soft hover:bg-danger/90',
      },
      size: {
        default: 'h-12 px-5 text-base',
        sm: 'h-10 px-4 text-sm',
        lg: 'h-14 px-7 text-lg',
        icon: 'size-12',
        'icon-sm': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (a `Link`) with the button's look instead of a `<button>`. */
    readonly asChild?: boolean;
  };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';

  return (
    <Component
      data-slot="button"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
