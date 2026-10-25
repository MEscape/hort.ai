import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** Lili's treat: a carrot with leafy green top. */
export function Carrot({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <g transform="rotate(35 32 32)">
        <path
          d="M32 12C26 8 22 11 24 14C20 12 18 16 22 18C24 19 28 19 32 17C36 19 40 19 42 18C46 16 44 12 40 14C42 11 38 8 32 12Z"
          className="fill-success-border stroke-copy"
        />
        <path
          d="M22 20C22 18 42 18 42 20C42 30 36 50 33.2 57C32.6 58.4 31.4 58.4 30.8 57C28 50 22 30 22 20Z"
          className="fill-accent stroke-copy"
        />
        <path d="M27 28H31M33 36H37M29 44H32" className="stroke-nudge-border" />
      </g>
    </FoodSvg>
  );
}
