import type { ComponentProps } from 'react';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

/** A text link with the module's one link style. Keyboard focus comes from the global rule. */
export function AuthLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'rounded-token-sm font-semibold text-primary-copy underline underline-offset-4 hover:text-copy',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
