import { FoodSvg } from './food-svg';

import type { FoodProps } from './food-svg';

/** Max's treat: a bone, tilted, with a cream fill and a small shine. */
export function Bone({ className }: FoodProps) {
  return (
    <FoodSvg className={className}>
      <g transform="rotate(-38 32 32)">
        <path
          d="M18.9 26H45.1A7 7 0 1 1 52 32A7 7 0 1 1 45.1 38H18.9A7 7 0 1 1 12 32A7 7 0 1 1 18.9 26Z"
          className="fill-surface stroke-copy"
        />
        <path d="M22 30.5H36" className="stroke-sunken" />
      </g>
    </FoodSvg>
  );
}
