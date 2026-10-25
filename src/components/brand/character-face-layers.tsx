import type { CSSProperties } from 'react';

import {
  CharacterFaceOverlay,
  type CharacterExpression,
  type CharacterFace,
} from '@components/brand/character-face';

import { cn } from '@lib/utils';

import type { FaceFrame } from './character-face-types';

export interface CharacterFaceLayersProps {
  readonly face: CharacterFace;
  readonly expression: CharacterExpression;
  /** The face of the open-mouth picture, when it differs from the closed one. */
  readonly openFrame: FaceFrame | undefined;
  readonly isMouthOpen: boolean;
  /** True until the picture under the face is loaded, so the face never floats in empty space. */
  readonly isHidden: boolean;
  readonly openStyle: CSSProperties | undefined;
}

/** The face drawn over the closed picture and, when its eyes sit elsewhere, over the open one: only the one under the visible mouth shows. */
export function CharacterFaceLayers({
  face,
  expression,
  openFrame,
  isMouthOpen,
  isHidden,
  openStyle,
}: CharacterFaceLayersProps) {
  return (
    <>
      <CharacterFaceOverlay
        frame={face.closed}
        face={face}
        expression={expression}
        className={cn(
          (openFrame !== undefined && isMouthOpen) || isHidden ? 'opacity-0' : undefined,
        )}
      />
      {openFrame !== undefined && (
        <CharacterFaceOverlay
          frame={openFrame}
          face={face}
          expression={expression}
          className={cn((!isMouthOpen || isHidden) && 'opacity-0')}
          style={openStyle}
        />
      )}
    </>
  );
}
