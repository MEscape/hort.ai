import { clamp } from '@lib/utils';

import type {
  CharacterExpression,
  CharacterFace,
  FaceEye,
  FaceSplit,
} from './character-face-types';

const HALF = 0.5;
/** Far enough to cover a whole picture from any point inside it. */
export const BIG = 4;
const LINE = 0.09;
const LID_CURVE = 0.3;
const LID_REACH = 2.2;
/** The lid's last stretch grows with the cube of the level, so the corners close at the end. */
const CLOSING_POWER = 3;
const LOOK_SHIFT = 0.1;
/** A shut eye keeps its line at the middle of the eye; the fill goes on to cover all of it. */
const LINE_STOP = 0.66;
const HAPPY = { reach: 0.62, drop: 0.18, rise: 0.78, stroke: 0.3 } as const;

/** The region of the page above (`-BIG`) or below (`BIG`) the fur line that crosses an eye. */
export function splitPolygon(eye: FaceEye, [left, right]: FaceSplit, direction: number): string {
  const [x, y, w, h] = eye.box;
  const yLeft = y + left * h;
  const yRight = y + right * h;
  const slope = (yRight - yLeft) / w;
  return `${x - BIG},${yLeft - slope * BIG} ${x + w + BIG},${yRight + slope * BIG} ${x + w + BIG},${y + direction} ${x - BIG},${y + direction}`;
}

/** Everything one eye needs to draw, from its geometry and the expression. */
export interface EyeLayout {
  readonly lids: number;
  readonly isHappy: boolean;
  readonly lookShift: number;
  readonly stroke: number;
  readonly lidShape: string;
  readonly lidTravel: number;
  readonly lineTravel: number;
  readonly linePath: string;
  readonly happyPath: string;
  readonly happyStroke: number;
}

function lookShift(look: CharacterExpression['look'], width: number): number {
  if (look === 'left') {
    return -LOOK_SHIFT * width;
  }
  return look === 'right' ? LOOK_SHIFT * width : 0;
}

/**
 * The lid is a tall shape parked just above the eye and slid down by transform alone. At level `l` it
 * covers `l` of the eye at its middle; the last stretch also closes the corners.
 */
export function eyeLayout(eye: FaceEye, expression: CharacterExpression): EyeLayout {
  const [x, y, w, h] = eye.box;
  const lids = clamp(expression.lids ?? 0, 0, 1);
  const stroke = h * LINE;
  const curve = h * LID_CURVE;
  const reach = x - stroke;
  const width = w + stroke * 2;
  const edge = y - stroke * 2 - curve;
  const cx = x + w * HALF;
  const cy = y + h * HALF;
  const travelOf = (level: number) =>
    level * (h + stroke * 2) + level ** CLOSING_POWER * (curve + stroke);
  const arc = (from: number, bend: number) => `${cx - w * from * HALF} ${cy + h * bend}`;

  return {
    lids,
    isHappy: expression.eyes === 'happy',
    lookShift: lookShift(expression.look, w),
    stroke,
    lidShape: `M${reach} ${y - h * LID_REACH}H${reach + width}V${edge}Q${cx} ${edge + curve * 2} ${reach} ${edge}Z`,
    lidTravel: travelOf(lids),
    lineTravel: travelOf(Math.min(lids, LINE_STOP)),
    linePath: `M${reach} ${edge}Q${cx} ${edge + curve * 2} ${reach + width} ${edge}`,
    happyPath: `M${arc(HAPPY.reach, HAPPY.drop)}Q${cx} ${cy - h * HAPPY.rise} ${cx + w * HAPPY.reach * HALF} ${cy + h * HAPPY.drop}`,
    happyStroke: h * HAPPY.stroke,
  };
}

/** The fur colours of one eye, top to bottom, with the ids of the clips that keep each in its band. */
export interface Band {
  readonly color: string;
  readonly clipId?: string;
}

/** One band, or two (above and below the fur line) when the fur changes colour across the eye. */
export function lidBands(face: CharacterFace, id: string, index: number): readonly Band[] {
  if (face.lidColorLow === undefined || face.lidSplit === undefined) {
    return [{ color: face.lidColor }];
  }
  return [
    { color: face.lidColor, clipId: `${id}u${index}` },
    { color: face.lidColorLow, clipId: `${id}d${index}` },
  ];
}
