import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** Fina's treat: a glowing fire-gem with a few facets. */
export function FireGem({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <path d="M20 12H44L56 26L32 56L8 26Z" className="fill-danger-border stroke-copy" />
      <path d="M20 12L26 26H38L44 12" className="fill-accent stroke-copy" />
      <path d="M8 26H56M26 26L32 56L38 26" className="fill-none stroke-copy" />
      <path
        d="M32 3C35 6 35 9 32 11C29 9 29 6 32 3Z"
        className="fill-nudge-border stroke-copy"
        strokeWidth="2.5"
      />
    </FoodSvg>
  );
}
