import type { ComponentType } from 'react';

import {
  Clock,
  Heart,
  Leaf,
  Lightbulb,
  Palette,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
} from '@components/ui/icons';
import type { IconProps } from '@components/ui/icons';

/** A picture for each trait word of the catalog, so a child who cannot read yet still gets the idea. */
const TRAIT_ICONS = {
  treu: Heart,
  energiegeladen: Sun,
  ermutigend: Star,
  geduldig: Clock,
  sanft: Leaf,
  klug: Lightbulb,
  mutig: ShieldCheck,
  kreativ: Palette,
  verspielt: Puzzle,
} as const satisfies Record<string, ComponentType<IconProps>>;

/** The trait words of the catalog that have a picture and a translation. */
export type KnownTrait = keyof typeof TRAIT_ICONS;

export const isKnownTrait = (trait: string): trait is KnownTrait => trait in TRAIT_ICONS;

export const traitIconOf = (trait: string): ComponentType<IconProps> =>
  isKnownTrait(trait) ? TRAIT_ICONS[trait] : Sparkles;
