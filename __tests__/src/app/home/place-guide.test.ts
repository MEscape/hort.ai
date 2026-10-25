import { describe, expect, it } from 'vitest';

import {
  BUBBLE_MAX_WIDTH,
  GUIDE_SCALE,
  placeBubble,
  placeCompanion,
} from '@/app/[locale]/(app)/home/_components/place-guide';

const root = { width: 1000, height: 800 };
const home = { left: 100, top: 300, width: 200, height: 200 };
const half = (home.width * GUIDE_SCALE) / 2;

describe('placeCompanion', () => {
  it('stands beside the card, on its left, when the cards sit next to the stage', () => {
    const card = { left: 600, top: 200, width: 300, height: 120 };
    const at = placeCompanion({ root, home, target: card, isWide: true });
    expect(at.x).toBeLessThan(card.left - half);
    expect(at.y).toBe(card.top + card.height / 2);
  });

  it('stands on the top corner of the card when the cards are stacked below the stage', () => {
    const card = { left: 16, top: 500, width: 328, height: 120 };
    const at = placeCompanion({
      root: { width: 360, height: 800 },
      home,
      target: card,
      isWide: false,
    });
    expect(at.y).toBe(card.top);
    expect(at.x).toBeGreaterThan(card.left + card.width / 2);
    expect(at.x).toBeLessThanOrEqual(card.left + card.width);
  });

  it('never leaves the screen', () => {
    const corner = { left: 0, top: 0, width: 300, height: 60 };
    expect(placeCompanion({ root, home, target: corner, isWide: true })).toEqual({
      x: half,
      y: half,
    });
    const bottom = { left: 900, top: 790, width: 100, height: 60 };
    const at = placeCompanion({ root, home, target: bottom, isWide: false });
    expect(at.x).toBeLessThanOrEqual(root.width - half);
    expect(at.y).toBeLessThanOrEqual(root.height - half);
  });
});

describe('placeBubble', () => {
  it('sits above what it speaks for, centred on it', () => {
    const anchor = { left: 400, top: 300, width: 100, height: 100 };
    expect(placeBubble({ root, anchor })).toMatchObject({ x: 450, y: 300 - 12, isBelow: false });
  });

  it('is as wide as what it speaks for, within a readable minimum and maximum', () => {
    const narrow = { left: 400, top: 300, width: 40, height: 40 };
    expect(placeBubble({ root, anchor: narrow }).width).toBe(200);
    expect(placeBubble({ root, anchor: { ...narrow, width: 240 } }).width).toBe(240);
    expect(placeBubble({ root, anchor: { ...narrow, width: 900 } }).width).toBe(BUBBLE_MAX_WIDTH);
  });

  it('is pulled back into the screen on the left and on the right', () => {
    const left = placeBubble({ root, anchor: { left: 0, top: 300, width: 40, height: 40 } });
    expect(left.x).toBeGreaterThanOrEqual(left.width / 2);
    const right = placeBubble({ root, anchor: { left: 960, top: 300, width: 40, height: 40 } });
    expect(right.x).toBeLessThanOrEqual(root.width - right.width / 2);
  });

  it('shrinks to a narrow screen instead of overflowing it', () => {
    const narrow = placeBubble({
      root: { width: 280, height: 600 },
      anchor: { left: 100, top: 300, width: 40, height: 40 },
    });
    expect(narrow.x).toBe(120);
    expect(narrow.width).toBeLessThanOrEqual(280 - 16);
  });

  it('goes under the anchor when there is no room above it', () => {
    const at = placeBubble({ root, anchor: { left: 400, top: 20, width: 100, height: 60 } });
    expect(at).toMatchObject({ isBelow: true, y: 20 + 60 + 12 });
  });
});
