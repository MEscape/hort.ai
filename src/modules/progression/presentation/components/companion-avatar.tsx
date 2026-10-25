'use client';

import type { Ref } from 'react';

import { Character } from '@components/brand/character';

import { useCharacterExpression } from '@hooks/use-character-expression';
import type { CharacterReaction } from '@hooks/use-character-expression';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { mouthStyleOf, type CompanionVisual } from './companion-visual';
import { Food } from './food/food';

import type { BoredomLevel, CompanionMood } from '../dto/progress-dto';

/**
 * What the companion does because of something the child did and the server confirmed (or, for
 * `pending` and `chew`, while the food is on its way or being eaten). `hop` and `cheer` add a jump.
 */
export type CompanionReaction = 'none' | 'hop' | CharacterReaction;

export interface CompanionAvatarProps {
  readonly companion: CompanionVisual;
  readonly mood: CompanionMood;
  /** How sleepy or bored the face looks, from the days the child was away. */
  readonly boredomLevel?: BoredomLevel;
  readonly reaction?: CompanionReaction;
  readonly isSpeaking?: boolean;
  /** Makes the mouth measurable: the feeding game aims the food at this element. */
  readonly mouthRef?: Ref<HTMLSpanElement>;
  /** Shows the mouth as a place to drop the food. */
  readonly isMouthHinted?: boolean;
  readonly className?: string;
}

const VERY_BORED = 4;

const IDLE_BY_BOREDOM = [
  'animate-companion-lively',
  'animate-companion-calm',
  'animate-companion-sleepy',
  'animate-companion-sleepy',
  'animate-companion-sleepy',
] as const satisfies readonly string[];

const MOTION_BY_REACTION = {
  none: undefined,
  hop: 'animate-hop',
  pending: undefined,
  chew: 'animate-companion-chew',
  happy: 'animate-hop',
  cheer: 'animate-companion-cheer',
} as const satisfies Record<CompanionReaction, string | undefined>;

const EXPRESSION_BY_REACTION = {
  none: 'none',
  hop: 'happy',
  pending: 'pending',
  chew: 'chew',
  happy: 'happy',
  cheer: 'cheer',
} as const satisfies Record<CompanionReaction, CharacterReaction>;

/** A thought bubble with the companion's treat: "snack time?", shown to the very bored companion. */
function SnackThought({ companionId }: { readonly companionId: string | undefined }) {
  return (
    <span
      aria-hidden="true"
      data-thought="snack"
      className="absolute -top-1 -right-1 flex animate-thought items-end gap-1"
    >
      <span className="mb-1 size-2 rounded-full border-2 border-border-strong bg-surface" />
      <span className="flex size-16 items-center justify-center rounded-full border-2 border-border-strong bg-surface p-2 shadow-soft">
        <Food companionId={companionId} className="size-full" />
      </span>
    </span>
  );
}

/**
 * The chosen companion, its face answering what is true: how long the child was away (lids, slump,
 * yawns, eyes drifting, a thought bubble with the treat) and what the child just did (waits with an
 * open mouth, chews, happy eyes). The face is a vector overlay on the existing pictures and a
 * companion without face data stays a picture. Nothing here ever looks sad: sleepy and bored are
 * relaxed looks, and the picture's text alternative says so in warm words. All motion is transform
 * and opacity; calm mode and reduced motion keep the resting pose of the level.
 */
export function CompanionAvatar({
  companion,
  mood,
  boredomLevel = 0,
  reaction = 'none',
  isSpeaking = false,
  mouthRef,
  isMouthHinted = false,
  className,
}: CompanionAvatarProps) {
  const t = useTranslations('progression');
  const { expression, ref } = useCharacterExpression({
    boredomLevel,
    reaction: EXPRESSION_BY_REACTION[reaction],
  });
  const isIdle = reaction === 'none';
  const idle = mood === 'new' ? 'animate-companion-wave' : IDLE_BY_BOREDOM[boredomLevel];

  return (
    <span
      ref={ref}
      className={cn('relative inline-block size-28', className)}
      data-mood={mood}
      data-boredom={boredomLevel}
    >
      <span className={cn('block size-full origin-bottom', isIdle && idle)}>
        <span className={cn('block size-full origin-bottom', MOTION_BY_REACTION[reaction])}>
          <Character
            imageUrl={companion.imageUrl}
            openImageUrl={companion.imageOpenUrl}
            openAlignment={companion.openAlignment}
            face={companion.face}
            expression={expression}
            isSpeaking={isSpeaking}
            alt={t(`mood.${mood}`, { name: companion.name })}
            className="size-full"
          />
        </span>
        <span
          ref={mouthRef}
          aria-hidden="true"
          data-mouth=""
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-dashed transition-opacity duration-150',
            isMouthHinted
              ? 'animate-pulse border-accent opacity-100'
              : 'border-transparent opacity-0',
          )}
          style={{ ...mouthStyleOf(companion), width: '30%', height: '30%' }}
        />
      </span>
      {boredomLevel === VERY_BORED && isIdle && <SnackThought companionId={companion.id} />}
    </span>
  );
}
