import type { ReactNode } from 'react';

import { Check, CircleAlert } from '@components/ui/icons';

import { cn } from '@lib/utils';

const TONES = {
  error: { icon: CircleAlert, text: 'text-danger' },
  success: { icon: Check, text: 'text-success' },
  hint: { icon: null, text: 'text-copy-muted' },
} as const;

export interface FieldMessageProps {
  /** The id the field points at with `aria-describedby`. */
  readonly id: string;
  readonly tone?: keyof typeof TONES;
  /** Nothing is drawn without text. */
  readonly children?: ReactNode;
}

/**
 * One line under a field: a mistake to fix, a tick, or a hint. An error always carries an icon
 * and words, so the colour is never the only way to see it.
 */
export function FieldMessage({ id, tone = 'error', children }: FieldMessageProps) {
  if (children === undefined || children === null || children === '') {
    return null;
  }
  const { icon: Icon, text } = TONES[tone];

  return (
    <p id={id} className={cn('flex items-start gap-2 text-base leading-snug', text)}>
      {Icon !== null && <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}
