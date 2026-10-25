'use client';

import { Character } from '@components/brand/character';
import type { MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face-types';

import { useCharacterExpression } from '@hooks/use-character-expression';
import type { CharacterReaction } from '@hooks/use-character-expression';

import { cn } from '@lib/utils';

/** The companion's state machine on a stage: idle, curious, thinking, cheer, oops-try-again. */
export type MascotState = 'idle' | 'curious' | 'thinking' | 'cheer' | 'oops';

/** What a stage needs to draw a companion; a tutor option from the learner module fits. */
export interface CompanionLook {
  readonly imageUrl: string;
  readonly imageOpenUrl: string;
  readonly openAlignment?: MouthAlignment | undefined;
  readonly face?: CharacterFace | undefined;
}

/** The companion's state machine mapped onto the face it already has and one body movement. */
const FACE: Record<MascotState, CharacterReaction> = {
  idle: 'none',
  curious: 'happy',
  thinking: 'pending',
  cheer: 'cheer',
  oops: 'none',
};

const BODY: Record<MascotState, string> = {
  idle: '',
  curious: 'animate-hop',
  thinking: '',
  cheer: 'animate-companion-cheer',
  oops: 'animate-wobble',
};

interface StageCompanionProps {
  readonly companion: CompanionLook;
  readonly mascot: MascotState;
  /** Changes with every reaction, so the same movement plays again. */
  readonly beat: number;
}

/** The child's companion on a stage: reacts to the screen's events, never to free-form text. */
export function StageCompanion({ companion, mascot, beat }: StageCompanionProps) {
  const { expression, ref } = useCharacterExpression({ reaction: FACE[mascot] });
  return (
    <div ref={ref} key={`${mascot}-${beat}`} className={cn('shrink-0', BODY[mascot])}>
      <Character
        imageUrl={companion.imageUrl}
        openImageUrl={companion.imageOpenUrl}
        openAlignment={companion.openAlignment}
        face={companion.face}
        expression={expression}
        alt=""
        fetchPriority="high"
        className="size-24 sm:size-32"
      />
    </div>
  );
}
