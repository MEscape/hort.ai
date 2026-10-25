import { Apple } from './apple';
import { Bone } from './bone';
import { Carrot } from './carrot';
import { FireGem } from './fire-gem';

import type { FoodProps } from './food-svg';

export interface FoodPictureProps extends FoodProps {
  /** The companion's catalog id (`max`, `lili`, `fina`); every other companion gets an apple. */
  readonly companionId: string | undefined;
}

/** The treat that belongs to a companion: a bone, a carrot, a fire-gem. */
export function Food({ companionId, className }: FoodPictureProps) {
  switch (companionId) {
    case 'max':
      return <Bone className={className} />;
    case 'lili':
      return <Carrot className={className} />;
    case 'fina':
      return <FireGem className={className} />;
    default:
      return <Apple className={className} />;
  }
}
