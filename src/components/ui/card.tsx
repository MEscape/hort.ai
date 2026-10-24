import type { ComponentProps } from 'react';

import { cn } from '@lib/utils';

type CardTone = 'surface' | 'sunken' | 'highlight';

const TONE_CLASSES: Record<CardTone, string> = {
  surface: 'bg-surface border-border',
  sunken: 'bg-sunken border-highlight-border',
  highlight: 'bg-highlight border-highlight-border',
};

interface CardProps extends ComponentProps<'div'> {
  readonly tone?: CardTone;
}

/** Reusable visual panel; it is not clickable unless composed with a real link or button. */
export function Card({ className, tone = 'surface', ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-token-xl border p-5 shadow-soft', TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}
