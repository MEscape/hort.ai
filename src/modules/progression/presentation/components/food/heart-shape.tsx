import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** A small heart for a happy companion; same outline language as the food. */
export function HeartShape({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <path
        d="M32 54C14 42 8 31 8 22C8 14 14 9 21 9C26 9 30 12 32 16C34 12 38 9 43 9C50 9 56 14 56 22C56 31 50 42 32 54Z"
        className="fill-bloom stroke-copy"
      />
    </FoodSvg>
  );
}
