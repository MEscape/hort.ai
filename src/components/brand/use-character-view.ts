'use client';

import type { CSSProperties } from 'react';

import { useLipSync } from '@hooks/use-lip-sync';
import { useMouthPulse } from '@hooks/use-mouth-pulse';

import type { MouthAlignment } from './character';
import type { CharacterExpression, CharacterFace, FaceFrame } from './character-face-types';

const PERCENT = 100;
const CHEW_OPEN_MS = 240;
const CHEW_SHUT_MS = 200;
const SLUMP_TILT_DEG = 6;
const SLUMP_SINK_PERCENT = 5;
const COOL_SATURATION = 0.22;
const POSE_MS = 700;

export interface CharacterViewInput {
  /** False while the open-mouth picture is still loading: the mouth then stays shut instead of blanking. */
  readonly isOpenReady: boolean;
  readonly imageUrl: string;
  readonly openImageUrl: string | undefined;
  readonly openAlignment: MouthAlignment | undefined;
  readonly isSpeaking: boolean;
  readonly expression: CharacterExpression | undefined;
  readonly face: CharacterFace | undefined;
}

export interface CharacterView {
  /** Whether there is an open-mouth picture to stack over the closed one. */
  readonly hasOpenPicture: boolean;
  /** Whether the mouth is open now. It never is before the open picture is loaded and decoded, so the swap never blanks. */
  readonly isMouthOpen: boolean;
  /** Placement of the open-mouth picture (and of its face overlay). */
  readonly alignmentStyle: CSSProperties | undefined;
  /** The face of the open-mouth picture, only when it differs from the closed one. */
  readonly openFrame: FaceFrame | undefined;
  /** Slump and cool tint of the whole character. */
  readonly poseStyle: CSSProperties | undefined;
}

function poseOf(expression: CharacterExpression | undefined): CSSProperties | undefined {
  const slump = expression?.slump ?? 0;
  const cool = expression?.cool ?? 0;
  if (slump === 0 && cool === 0) {
    return undefined;
  }
  return {
    transformOrigin: '50% 100%',
    transform: `rotate(${SLUMP_TILT_DEG * slump}deg) translateY(${SLUMP_SINK_PERCENT * slump}%)`,
    transitionDuration: `${POSE_MS}ms`,
    filter: cool === 0 ? undefined : `saturate(${1 - COOL_SATURATION * cool})`,
  };
}

function alignmentOf(alignment: MouthAlignment | undefined): CSSProperties | undefined {
  if (alignment === undefined) {
    return undefined;
  }
  return {
    transformOrigin: '0 0',
    transform: `translate(${alignment.x * PERCENT}%, ${alignment.y * PERCENT}%) scale(${alignment.scaleX}, ${alignment.scaleY})`,
  };
}

/** Whether the mouth is open: speaking, chewing, or held open (yawn, waiting for food). */
function useIsMouthOpen({ isSpeaking, expression }: CharacterViewInput, hasOpenPicture: boolean) {
  const isTalking = useLipSync(isSpeaking && hasOpenPicture);
  const isChewing = useMouthPulse(
    expression?.chewing === true && hasOpenPicture,
    CHEW_OPEN_MS,
    CHEW_SHUT_MS,
  );
  const isHeldOpen =
    hasOpenPicture && (expression?.yawning === true || expression?.mouthOpen === true);
  return isTalking || isChewing || isHeldOpen;
}

/**
 * What `Character` needs to draw: whether the picture can be shown, whether the mouth is open
 * (speaking, chewing or held open), and the styles for the open picture and the pose.
 */
export function useCharacterView(input: CharacterViewInput): CharacterView {
  const { openImageUrl, expression } = input;
  const hasOpenPicture = openImageUrl !== undefined && openImageUrl !== '';
  const isMouthOpen = useIsMouthOpen(input, hasOpenPicture && input.isOpenReady);

  return {
    hasOpenPicture,
    isMouthOpen,
    alignmentStyle: alignmentOf(input.openAlignment),
    openFrame: hasOpenPicture ? input.face?.open : undefined,
    poseStyle: poseOf(expression),
  };
}
