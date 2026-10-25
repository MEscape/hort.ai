'use client';

import { Character, type MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face';

import { useHappyBeat } from '@hooks/use-carousel';
import { useCharacterExpression } from '@hooks/use-character-expression';

export interface SlideCharacterProps {
  readonly imageUrl: string;
  readonly imageOpenUrl: string | undefined;
  readonly openAlignment: MouthAlignment | undefined;
  readonly face: CharacterFace | undefined;
  readonly isActive: boolean;
  /** Counts the choices made; each one makes the active character smile for a moment. */
  readonly hopToken: number;
}

/**
 * The picture of one slide. Only the active one has a living face: it blinks now and then and
 * smiles with closed eyes right after it was chosen. The open-mouth picture is loaded for the active
 * one only. One component for every slide (not one per role), so a slide that becomes active keeps
 * its pictures instead of loading them again.
 */
export function SlideCharacter({
  imageUrl,
  imageOpenUrl,
  openAlignment,
  face,
  isActive,
  hopToken,
}: SlideCharacterProps) {
  const isHappy = useHappyBeat(isActive ? hopToken : 0);
  // A neighbour is not alive: any reaction keeps the blinking timers of its unused face off.
  const { expression, ref } = useCharacterExpression({
    reaction: !isActive || isHappy ? 'happy' : 'none',
  });

  return (
    <span ref={ref} className="block">
      <Character
        imageUrl={imageUrl}
        openImageUrl={isActive ? imageOpenUrl : undefined}
        openAlignment={openAlignment}
        face={face}
        expression={isActive ? expression : undefined}
        alt=""
        fetchPriority={isActive ? 'high' : 'auto'}
        className="size-(--hero)"
      />
    </span>
  );
}
