import type { ReactNode } from 'react';

/** The shared frame of the food pictures: one square canvas, `currentColor` unused, decorative only. */
export function FoodSvg({
  className,
  children,
}: {
  readonly className?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export interface FoodProps {
  readonly className?: string | undefined;
}
