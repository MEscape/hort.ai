import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** The treat for any companion without a picture of its own. */
export function Apple({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <path
        d="M32 19C26 14 12 17 12 34C12 46 20 56 27 56C30 56 31 54.5 32 54.5C33 54.5 34 56 37 56C44 56 52 46 52 34C52 17 38 14 32 19Z"
        className="fill-danger-border stroke-copy"
      />
      <path d="M32 19C32 13 33 9 36 6" className="fill-none stroke-copy" />
      <path
        d="M35 14C39 8 46 9 47 11C45 16 39 17 35 14Z"
        className="fill-success-border stroke-copy"
      />
      <path d="M19 30C20 26 22 24 25 23" className="fill-none stroke-surface" />
    </FoodSvg>
  );
}
