'use client';

import type { ReactNode, RefObject } from 'react';

import { cn } from '@lib/utils';

export interface CompanionBubbleProps {
  /** One short line, in the companion's voice. It is announced when it changes. */
  readonly children: ReactNode;
  /** Text only for screen readers, said after the line (what the picture shows). */
  readonly srOnly?: string | undefined;
  /** For the moment the food button is gone: focus moves here so a keyboard child is not dropped. */
  readonly focusRef?: RefObject<HTMLParagraphElement | null>;
  readonly className?: string;
}

/**
 * A speech bubble above the companion, tail pointing down. The live region stays in place while the
 * line inside is replaced (and pops in again), so the change is announced and seen.
 */
export function CompanionBubble({ children, srOnly, focusRef, className }: CompanionBubbleProps) {
  return (
    <div role="status" className={cn('relative flex justify-center', className)}>
      <p
        ref={focusRef}
        tabIndex={-1}
        className="relative animate-pop rounded-token-xl border-2 border-border bg-surface px-5 py-2 text-center font-heading text-xl font-semibold text-balance shadow-soft outline-none after:absolute after:-bottom-2 after:left-1/2 after:size-4 after:-translate-x-1/2 after:rotate-45 after:rounded-br-sm after:border-r-2 after:border-b-2 after:border-border after:bg-surface after:content-[''] sm:text-2xl"
      >
        {children}
        {srOnly !== undefined && <span className="sr-only"> {srOnly}</span>}
      </p>
    </div>
  );
}
