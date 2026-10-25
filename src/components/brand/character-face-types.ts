/** A disc in the units of its picture (see `FaceFrame`). */
export interface FaceDisc {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Where the fur line crosses an eye: fractions of the eye's height at its left and right edge. */
export type FaceSplit = readonly [number, number];

/** One eye of one picture, measured on the drawing. */
export interface FaceEye {
  /** The eye-white as an SVG path: it clips the lids and is repainted when the eyes look aside. */
  readonly outline: string;
  /** Left, top, width and height of `outline`. */
  readonly box: readonly [number, number, number, number];
  readonly pupil: FaceDisc;
  readonly shine: FaceDisc;
}

/**
 * One picture of a character (closed or open mouth). Everything is in the picture's own units: its
 * height is 1 and its width is `aspect`, so the overlay can sit on the picture whatever size it is
 * shown at (`object-contain` and `viewBox` letterbox the same way).
 */
export interface FaceFrame {
  readonly aspect: number;
  /** As seen on the picture: the left eye first. */
  readonly eyes: readonly [FaceEye, FaceEye];
}

/** A spot on the picture's box, as fractions of its width and height (0,0 = top left). */
export interface FaceSpot {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a character's eyes are and what colours the lids need, so the face can be animated on top of
 * the flat pictures (sleepy lids, happy ^^ eyes, looking aside). Data only: it is measured once per
 * character and lives with the tutors. A character without it simply stays a picture.
 */
export interface CharacterFace {
  readonly closed: FaceFrame;
  /** The open-mouth picture, when its eyes sit elsewhere than on the closed one. */
  readonly open?: FaceFrame | undefined;
  /** The fur around the eyes: the lid is painted in it. */
  readonly lidColor: string;
  /** The fur below the eye when it differs from above (Max: blue above, cream below). */
  readonly lidColorLow?: string | undefined;
  /** Where the fur line crosses the left and the right eye; needed with `lidColorLow`. */
  readonly lidSplit?: readonly [FaceSplit, FaceSplit] | undefined;
  /** The character's outline colour: lid line and happy arcs. */
  readonly lineColor: string;
  readonly pupilColor: string;
  /** Where the mouth is: the feeding game aims the food there and the mouth opens there. */
  readonly mouth?: FaceSpot | undefined;
}

/**
 * How a character looks right now. Everything is optional and defaults to a plain open-eyed face, so
 * `{}` and `undefined` look the same. Mouth fields take the place of `isSpeaking` for silent mouth
 * movements; `slump` and `cool` are poses of the whole character.
 */
export interface CharacterExpression {
  /** `happy` is the ^^ look, `sleepy` the same as `open` plus floating "z"s (set `lids` as well). */
  readonly eyes?: 'open' | 'happy' | 'sleepy';
  /** 0 = lids fully up, 1 = eyes shut. */
  readonly lids?: number;
  /** Where the pupils look; leave out to keep the drawn ones. */
  readonly look?: 'center' | 'left' | 'right';
  /** Mouth alternates open and shut, slowly; static (shut) in calm mode. */
  readonly chewing?: boolean;
  /** Mouth held open, eyes squeezed. */
  readonly yawning?: boolean;
  /** Mouth held open without yawning (waiting for food). */
  readonly mouthOpen?: boolean;
  /** 0..1: tilt and sink, a loose posture. */
  readonly slump?: number;
  /** 0..1: a slight, static desaturation. */
  readonly cool?: number;
}
