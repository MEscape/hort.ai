import type { ComponentProps } from 'react';

import { cn } from '@lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'default' | 'lg' | 'icon';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground border-primary hover:shadow-lift active:shadow-soft',
  secondary:
    'bg-secondary text-secondary-foreground border-secondary hover:shadow-lift active:shadow-soft',
  accent: 'bg-accent text-accent-foreground border-accent hover:shadow-lift active:shadow-soft',
  outline: 'bg-surface text-primary-copy border-border-strong hover:bg-highlight active:bg-sunken',
  ghost: 'bg-transparent text-primary-copy border-transparent hover:bg-highlight active:bg-sunken',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-12 px-4 text-sm',
  default: 'min-h-14 px-6 text-base',
  lg: 'min-h-16 px-8 text-lg',
  icon: 'h-14 w-14 shrink-0 p-3',
};

interface ButtonProps extends ComponentProps<'button'> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}

/** A small app-owned, shadcn-style primitive using Hort.ai's approved semantic tokens. */
export function Button({
  className,
  variant = 'primary',
  size = 'default',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-token border-2 font-heading font-semibold',
        'whitespace-normal text-center leading-tight shadow-soft transition-transform duration-200',
        'ease-soft hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed',
        'disabled:opacity-60 disabled:shadow-none disabled:hover:translate-y-0',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  );
}
