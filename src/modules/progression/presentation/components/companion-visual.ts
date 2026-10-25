import type { MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face';

/** What a progression component needs to draw a companion; a `TutorOption` is assignable to it. */
export interface CompanionVisual {
  /** The catalog id (`max`, `lili`, `fina`): picks the treat. Others get defaults. */
  readonly id?: string | undefined;
  readonly name: string;
  /** Closed-mouth picture. */
  readonly imageUrl: string;
  /** Open-mouth picture, shown while the companion speaks. */
  readonly imageOpenUrl: string;
  readonly openAlignment?: MouthAlignment | undefined;
  /** Where the eyes and the mouth are (lids, ^^ eyes, feeding). Without it the companion is just the picture. */
  readonly face?: CharacterFace | undefined;
}

const MIDDLE_MOUTH = { x: 0.5, y: 0.6 };
const PERCENT = 100;

/** The mouth as a CSS position inside the companion's picture box; a middle guess without face data. */
export function mouthStyleOf(companion: CompanionVisual): { left: string; top: string } {
  const { x, y } = companion.face?.mouth ?? MIDDLE_MOUTH;
  return { left: `${x * PERCENT}%`, top: `${y * PERCENT}%` };
}
