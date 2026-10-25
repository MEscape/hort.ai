import type { CSSProperties, ReactNode } from 'react';

import { eyeLayout, type Band } from './character-face-layout';

import type { CharacterExpression, CharacterFace, FaceEye } from './character-face-types';

const LID_MS = 160;

function slide(distance: number, axis: 'X' | 'Y'): CSSProperties {
  return {
    transform: `translate${axis}(${distance}px)`,
    transition: `transform ${LID_MS}ms ease-out`,
  };
}

/** Paints in each band's clip. The clips do not move, so a lid slides through them. */
function Banded({
  bands,
  render,
}: {
  readonly bands: readonly Band[];
  readonly render: (color: string) => ReactNode;
}) {
  return bands.map((band) => (
    <g key={band.color} clipPath={band.clipId === undefined ? undefined : `url(#${band.clipId})`}>
      {render(band.color)}
    </g>
  ));
}

interface EyeProps {
  readonly eye: FaceEye;
  readonly face: CharacterFace;
  readonly expression: CharacterExpression;
  readonly clipId: string;
  readonly bands: readonly Band[];
}

/** One eye: repainted when the eyes look aside, then covered by the lid or the happy arc. */
export function CharacterEye({ eye, face, expression, clipId, bands }: EyeProps) {
  const layout = eyeLayout(eye, expression);

  return (
    <g clipPath={`url(#${clipId})`}>
      {expression.look !== undefined && (
        <>
          <path d={eye.outline} fill="#fff" />
          <g style={slide(layout.lookShift, 'X')}>
            <circle cx={eye.pupil.x} cy={eye.pupil.y} r={eye.pupil.r} fill={face.pupilColor} />
            <circle cx={eye.shine.x} cy={eye.shine.y} r={eye.shine.r} fill="#fff" />
          </g>
        </>
      )}
      <Banded
        bands={bands}
        render={(color) => (
          <path
            d={layout.lidShape}
            fill={color}
            style={slide(layout.lidTravel, 'Y')}
            data-lids={layout.lids}
          />
        )}
      />
      <g style={slide(layout.lineTravel, 'Y')}>
        <path
          d={layout.linePath}
          fill="none"
          stroke={face.lineColor}
          strokeWidth={layout.stroke}
          strokeLinecap="round"
        />
      </g>
      {layout.isHappy && (
        <>
          <Banded bands={bands} render={(color) => <path d={eye.outline} fill={color} />} />
          <path
            d={layout.happyPath}
            fill="none"
            stroke={face.lineColor}
            strokeWidth={layout.happyStroke}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}
