import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** A four-pointed sparkle for the moment a confirmed star arrives. */
export function SparkleShape({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <path
        d="M32 6C34 22 42 30 58 32C42 34 34 42 32 58C30 42 22 34 6 32C22 30 30 22 32 6Z"
        className="fill-accent stroke-copy"
      />
    </FoodSvg>
  );
}
