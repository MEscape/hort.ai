import { GUIDE_SCALE, placeBubble, placeCompanion } from './place-guide';

import type { GuideTarget } from './home-types';
import type { Box } from './place-guide';

/** The page's landscape layout: the cards stand beside the stage (`md` in Tailwind). */
const WIDE_QUERY = '(min-width: 48rem)';

export interface GuidePlace {
  readonly home: Box;
  /** Where the original companion stands, or `null` when it does not move. */
  readonly companion: { readonly x: number; readonly y: number } | null;
  readonly bubble: {
    readonly x: number;
    readonly y: number;
    readonly isBelow: boolean;
    readonly width: number;
  };
}

function boxOf(element: Element, root: DOMRect): Box {
  const box = element.getBoundingClientRect();
  return {
    left: box.left - root.left,
    top: box.top - root.top,
    width: box.width,
    height: box.height,
  };
}

/**
 * Reads the page and says where the companion stands (it walks to a card unless it is the stage or
 * motion is calm) and where its bubble hangs. The stage's bubble takes the level meter's place.
 * `null` while the page does not have the parts yet.
 */
export function measureGuide(
  root: HTMLElement,
  target: GuideTarget,
  isCalm: boolean,
): GuidePlace | null {
  const homeElement = root.querySelector('[data-guide-home]');
  const targetElement = root.querySelector(`[data-guide-target="${target}"]`);
  if (homeElement === null || targetElement === null) {
    return null;
  }
  const rootRect = root.getBoundingClientRect();
  const size = { width: rootRect.width, height: rootRect.height };
  const home = boxOf(homeElement, rootRect);
  const box = boxOf(targetElement, rootRect);
  const companion =
    target === 'stage' || isCalm
      ? null
      : placeCompanion({
          root: size,
          home,
          target: box,
          isWide: window.matchMedia(WIDE_QUERY).matches,
        });
  const half = (home.width * GUIDE_SCALE) / 2;
  const meter = root.querySelector('[data-guide-meter]');
  const meterBox = meter === null ? null : boxOf(meter, rootRect);
  // The line takes the meter's place: its bottom edge is where the bubble's tail points from.
  const stageAnchor =
    meterBox === null ? home : { ...meterBox, top: meterBox.top + meterBox.height };
  const standingAnchor = target === 'stage' ? stageAnchor : box;
  const anchor =
    companion === null
      ? standingAnchor
      : { left: companion.x - half, top: companion.y - half, width: 2 * half, height: 2 * half };
  return { home, companion, bubble: placeBubble({ root: size, anchor }) };
}
