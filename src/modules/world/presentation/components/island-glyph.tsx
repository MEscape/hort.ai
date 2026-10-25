import type { ReactNode } from 'react';

import type { Glyph } from '../catalog/island-vocabulary';

/**
 * The placeholder's stand-ins for landmarks and places. Each stands on (0, 0), about 24 units wide,
 * lit from the top left (the right faces are the shade colours) with a soft contact shadow.
 */
const SHAPES: Readonly<Record<Glyph, ReactNode>> = {
  tree: (
    <>
      <rect x="-2" y="-11" width="4" height="11" rx="1.5" className="fill-island-wood" />
      <circle cx="0" cy="-19" r="11" className="fill-island-leaf" />
      <path
        d="M6 -27a11 11 0 0 1 0 16a11 11 0 0 1 -12 2a11 11 0 0 0 12 -18Z"
        className="fill-island-leaf-shade"
      />
      <circle cx="-4" cy="-23" r="4.5" className="fill-island-leaf-light" />
    </>
  ),
  pine: (
    <>
      <rect x="-2" y="-6" width="4" height="6" className="fill-island-wood" />
      <path d="M0 -38L11 -18H-11Z M0 -30L13 -6H-13Z" className="fill-island-leaf-shade" />
      <path d="M0 -38L0 -18H-11Z M0 -30L0 -6H-13Z" className="fill-island-leaf" />
    </>
  ),
  house: (
    <>
      <rect x="-11" y="-15" width="22" height="15" rx="1.5" className="fill-island-wall" />
      <rect x="4" y="-15" width="7" height="15" className="fill-island-stone" />
      <path d="M-14 -14L0 -28L14 -14Z" className="fill-island-roof" />
      <path d="M0 -28L14 -14H4Z" className="fill-copy/15" />
      <rect x="-5" y="-9" width="6" height="9" rx="2" className="fill-island-wood" />
    </>
  ),
  tower: (
    <>
      <rect x="-7" y="-34" width="14" height="34" rx="2" className="fill-island-stone" />
      <rect x="1" y="-34" width="6" height="34" className="fill-island-stone-shade" />
      <path d="M-10 -33L0 -48L10 -33Z" className="fill-island-roof" />
      <path d="M0 -48L10 -33H2Z" className="fill-copy/15" />
      <circle cx="0" cy="-24" r="3" className="fill-island-water-light" />
    </>
  ),
  mountain: (
    <>
      <path d="M-24 0L-4 -40L4 -34L24 0Z" className="fill-island-rock" />
      <path d="M-4 -40L4 -34L24 0H6Z" className="fill-island-rock-shade" />
      <path d="M-4 -40L4 -34L1 -28L-4 -31L-9 -28Z" className="fill-island-snow" />
    </>
  ),
  pond: (
    <>
      <ellipse cx="0" cy="-3" rx="15" ry="5.5" className="fill-island-water" />
      <ellipse cx="-4" cy="-4" rx="6" ry="1.6" className="fill-island-water-light" />
    </>
  ),
  windmill: (
    <>
      <path d="M-7 0L-4 -26H4L7 0Z" className="fill-island-wall" />
      <path d="M1 -26H4L7 0H2Z" className="fill-island-stone" />
      <path
        d="M0 -26L-15 -40M0 -26L14 -41M0 -26L-14 -11M0 -26L15 -12"
        className="stroke-island-wood"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="0" cy="-26" r="2.5" className="fill-island-roof" />
    </>
  ),
  tent: (
    <>
      <path d="M-13 0L0 -22L13 0Z" className="fill-accent" />
      <path d="M0 -22L13 0H3Z" className="fill-bloom" />
      <path d="M0 -10L-4 0H4Z" className="fill-island-wood-shade" />
    </>
  ),
  flowers: (
    <>
      <ellipse cx="0" cy="-5" rx="12" ry="6" className="fill-island-leaf" />
      <circle cx="-6" cy="-8" r="2.6" className="fill-island-petal" />
      <circle cx="1" cy="-10" r="2.6" className="fill-accent" />
      <circle cx="6" cy="-6" r="2.6" className="fill-island-wall" />
      <circle cx="-1" cy="-4" r="2.2" className="fill-bloom" />
    </>
  ),
  rock: (
    <>
      <path d="M-12 0C-14 -9 -8 -16 0 -16C8 -16 13 -9 12 0Z" className="fill-island-stone" />
      <path d="M2 -16C8 -15 13 -9 12 0H3C6 -5 6 -11 2 -16Z" className="fill-island-stone-shade" />
      <ellipse cx="-5" cy="-10" rx="3" ry="1.8" className="fill-island-wall/60" />
    </>
  ),
  boat: (
    <>
      <path d="M-14 -6H14L9 0H-9Z" className="fill-island-wood" />
      <path d="M0 -6V-30" className="stroke-island-wood-shade" strokeWidth="1.6" />
      <path d="M1 -29L12 -9H1Z" className="fill-island-wall" />
      <path d="M-1 -24L-9 -9H-1Z" className="fill-island-water-light" />
    </>
  ),
  dome: (
    <>
      <rect x="-12" y="-10" width="24" height="10" rx="1.5" className="fill-island-wall" />
      <rect x="4" y="-10" width="8" height="10" className="fill-island-stone" />
      <path d="M-12 -10A12 12 0 0 1 12 -10Z" className="fill-island-water-light" />
      <path d="M0 -22A12 12 0 0 1 12 -10H4A10 12 0 0 0 0 -22Z" className="fill-island-water" />
    </>
  ),
  stage: (
    <>
      <rect x="-14" y="-6" width="28" height="6" rx="1.5" className="fill-island-wood" />
      <rect x="6" y="-6" width="8" height="6" className="fill-island-wood-shade" />
      <path
        d="M-11 -6V-16A11 9 0 0 1 11 -16V-6"
        className="stroke-island-roof"
        strokeWidth="3"
        fill="none"
      />
    </>
  ),
  bridge: (
    <>
      <path
        d="M-15 -2Q0 -16 15 -2"
        className="stroke-island-wood"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M-15 -8Q0 -22 15 -8"
        className="stroke-island-wood-shade"
        strokeWidth="1.6"
        fill="none"
      />
      <path
        d="M-10 -12V-6M0 -15V-9M10 -12V-6"
        className="stroke-island-wood-shade"
        strokeWidth="1.6"
      />
    </>
  ),
  signpost: (
    <>
      <rect x="-1.5" y="-26" width="3" height="26" className="fill-island-wood-shade" />
      <path d="M-1 -24H11L14 -21L11 -18H-1Z" className="fill-island-wood" />
      <path d="M1 -16H-11L-14 -13L-11 -10H1Z" className="fill-island-wood" />
    </>
  ),
  cube: (
    <>
      <path d="M0 -24L12 -18L0 -12L-12 -18Z" className="fill-island-wall" />
      <path d="M-12 -18L0 -12V0L-12 -6Z" className="fill-accent" />
      <path d="M12 -18L0 -12V0L12 -6Z" className="fill-bloom" />
    </>
  ),
};

export interface IslandGlyphProps {
  readonly glyph: Glyph;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
}

export function IslandGlyph({ glyph, x, y, scale = 1 }: IslandGlyphProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="12" ry="3" className="fill-copy/15" />
      {SHAPES[glyph]}
    </g>
  );
}
