import type { FaceEye } from './character-face-types';

const Z = 'z';
const SIZE = 0.55;
const OUTLINE = 0.18;
/** Where each "z" stands, in eye widths to the right and eye heights above the eye, and how big it is. */
const ZS = [
  { id: 'near', right: 1.05, above: 0.15, grow: 1 },
  { id: 'far', right: 1.35, above: 0.65, grow: 1.3 },
] as const;

/** Two "z"s above the right eye; they float in motion mode and stand still in calm mode. */
export function CharacterZzz({
  eye,
  lineColor,
  isStatic,
}: {
  readonly eye: FaceEye;
  readonly lineColor: string;
  readonly isStatic: boolean;
}) {
  const [x, y, w, h] = eye.box;
  const size = h * SIZE;
  return (
    <g
      className={isStatic ? undefined : 'animate-face-zzz'}
      fill={lineColor}
      stroke="#fff"
      strokeWidth={size * OUTLINE}
      paintOrder="stroke"
      strokeLinejoin="round"
      fontFamily="system-ui, sans-serif"
      fontWeight="800"
      data-testid="character-zzz"
    >
      {ZS.map(({ id, right, above, grow }) => (
        <text key={id} x={x + w * right} y={y - h * above} fontSize={size * grow}>
          {Z}
        </text>
      ))}
    </g>
  );
}
