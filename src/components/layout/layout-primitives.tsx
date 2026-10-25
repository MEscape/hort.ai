import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@lib/utils';

/**
 * The frame of a whole screen: at least the window's height, a column of header and main. It is the
 * stacking context (`isolate`), so a decorative scene placed first and absolutely positioned (the
 * `WorldScene`) stays behind the content without a z-index war with the rest of the page.
 */
export function PageShell({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('relative isolate flex min-h-dvh flex-1 flex-col', className)} {...props} />
  );
}

/**
 * The top of a screen: the logo, not a navigation bar (the child's screens have no menus). A
 * `<header>` outside any section is the page's banner landmark.
 */
export interface PageHeaderProps extends ComponentPropsWithoutRef<'header'> {
  /** False when the content brings its own `<header>` (the account header), so the page keeps one banner. */
  readonly isLandmark?: boolean;
}

export function PageHeader({ isLandmark = true, className, ...props }: PageHeaderProps) {
  const Bar = isLandmark ? 'header' : 'div';
  return (
    <Bar
      className={cn(
        'relative z-10 flex justify-center px-4 pt-6 sm:justify-start sm:px-10 sm:pt-8',
        className,
      )}
      {...props}
    />
  );
}

const PAGE_MAIN_CLASSES = {
  /** One card in a reading-width column; the top room is where Hort sits on the card's edge. */
  panel: 'relative z-10 flex-1 items-start pt-24 pb-28 sm:items-center sm:pt-20',
  /** A lone panel (an error) in the middle of the window. */
  centered: 'min-h-dvh items-center',
} as const;

export interface PageMainProps extends ComponentPropsWithoutRef<'main'> {
  readonly variant?: keyof typeof PAGE_MAIN_CLASSES;
}

/** The page's one `<main>` landmark, with the side gutters that keep a panel off a 320px phone's edges. */
export function PageMain({ variant = 'panel', className, children, ...props }: PageMainProps) {
  return (
    <main
      className={cn('flex justify-center px-4', PAGE_MAIN_CLASSES[variant], className)}
      {...props}
    >
      {variant === 'panel' ? <div className="w-full max-w-lg">{children}</div> : children}
    </main>
  );
}
