import { clamp } from '@lib/utils';

/** A rectangle in the page's own coordinates (left and top measured from the page container). */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** The guide stands next to a card at this fraction of its size on the stage. */
export const GUIDE_SCALE = 0.5;
/** The widest the speech bubble gets; on a narrower screen it takes the screen less its margins. */
export const BUBBLE_MAX_WIDTH = 288;
const GAP = 12;
const EDGE_MARGIN = 8;
/** A bubble is never narrower than this, so a short anchor does not squeeze the words. */
const BUBBLE_MIN_WIDTH = 200;
/** Under this much room above an anchor, the bubble goes below it. */
const MIN_ROOM_ABOVE = 96;

/** Keeps `value` in `[min, max]`; a screen narrower than the thing placed in it wins for `min`. */
const within = (value: number, min: number, max: number): number =>
  clamp(value, min, Math.max(min, max));

interface CompanionPlacement {
  readonly root: Size;
  readonly home: Box;
  readonly target: Box;
  /** Cards stand beside the stage (landscape); else they are stacked below it. */
  readonly isWide: boolean;
}

/**
 * Where the guide's centre goes to stand next to a card: on its left when the stage is beside the
 * cards, on its top corner when they are stacked. Always inside the page.
 */
export function placeCompanion({ root, home, target, isWide }: CompanionPlacement): Point {
  const half = (home.width * GUIDE_SCALE) / 2;
  const x = isWide ? target.left - half - GAP : target.left + target.width - half - GAP;
  const y = isWide ? target.top + target.height / 2 : target.top;
  return { x: within(x, half, root.width - half), y: within(y, half, root.height - half) };
}

interface BubblePlacement {
  readonly root: Size;
  /** What the bubble speaks for: the guide standing beside a card, or the card itself in calm mode. */
  readonly anchor: Box;
}

/**
 * The bubble's anchor point (its horizontal centre and the edge its tail touches) and its width: as
 * wide as what it speaks for (at least a readable minimum), kept inside the page.
 */
export function placeBubble({
  root,
  anchor,
}: BubblePlacement): Point & { readonly isBelow: boolean; readonly width: number } {
  const widest = Math.min(BUBBLE_MAX_WIDTH, root.width - 2 * EDGE_MARGIN);
  const width = Math.min(widest, clamp(anchor.width, BUBBLE_MIN_WIDTH, BUBBLE_MAX_WIDTH));
  const half = width / 2;
  const x = within(
    anchor.left + anchor.width / 2,
    half + EDGE_MARGIN,
    root.width - half - EDGE_MARGIN,
  );
  const isBelow = anchor.top < MIN_ROOM_ABOVE;
  return { x, y: isBelow ? anchor.top + anchor.height + GAP : anchor.top - GAP, isBelow, width };
}
