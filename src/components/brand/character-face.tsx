'use client';

import { useId, type CSSProperties } from 'react';

import { useCalmMotion } from '@hooks/use-calm-motion';

import { cn } from '@lib/utils';

import { CharacterEye } from './character-face-eye';
import { BIG, lidBands, splitPolygon } from './character-face-layout';
import { CharacterZzz } from './character-face-zzz';

import type {
  CharacterExpression,
  CharacterFace,
  FaceFrame,
  FaceSplit,
} from './character-face-types';

export type {
  CharacterExpression,
  CharacterFace,
  FaceDisc,
  FaceEye,
  FaceFrame,
  FaceSplit,
} from './character-face-types';

const HALF = 0.5;
const FLAT: FaceSplit = [HALF, HALF];

export interface CharacterFaceOverlayProps {
  readonly frame: FaceFrame;
  readonly face: CharacterFace;
  readonly expression: CharacterExpression;
  readonly className?: string;
  /** Lays the overlay over a picture that was shifted (the open-mouth one). */
  readonly style?: CSSProperties | undefined;
}

/**
 * The animated part of a character's face: lids, happy ^^ eyes, eyes looking aside. An SVG laid over
 * its picture, same box, so it scales with it. Only transforms animate (the lid slides, nothing is
 * re-laid-out) and calm mode turns the transitions off through the global rule. Decorative: the
 * picture carries the name.
 */
export function CharacterFaceOverlay({
  frame,
  face,
  expression,
  className,
  style,
}: CharacterFaceOverlayProps) {
  const id = useId().replace(/\W/g, '');
  const isCalm = useCalmMotion();
  const splits = face.lidColorLow === undefined ? undefined : face.lidSplit;

  return (
    <svg
      viewBox={`0 0 ${frame.aspect} 1`}
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none absolute inset-0 size-full overflow-visible', className)}
      style={style}
    >
      <defs>
        {frame.eyes.map((eye, index) => (
          <g key={index === 0 ? 'l' : 'r'}>
            <clipPath id={`${id}c${index}`}>
              <path d={eye.outline} />
            </clipPath>
            {splits !== undefined && (
              <>
                <clipPath id={`${id}u${index}`}>
                  <polygon points={splitPolygon(eye, splits[index] ?? FLAT, -BIG)} />
                </clipPath>
                <clipPath id={`${id}d${index}`}>
                  <polygon points={splitPolygon(eye, splits[index] ?? FLAT, BIG)} />
                </clipPath>
              </>
            )}
          </g>
        ))}
      </defs>
      {frame.eyes.map((eye, index) => (
        <CharacterEye
          key={index === 0 ? 'l' : 'r'}
          eye={eye}
          face={face}
          expression={expression}
          clipId={`${id}c${index}`}
          bands={lidBands(face, id, index)}
        />
      ))}
      {expression.eyes === 'sleepy' && (
        <CharacterZzz eye={frame.eyes[1]} lineColor={face.lineColor} isStatic={isCalm} />
      )}
    </svg>
  );
}
