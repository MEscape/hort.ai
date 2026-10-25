import { isDefined } from '@lib/utils';

import { WORLD_AREAS } from '../../application/contracts/world-constraints';

import type { Subject } from '../../application/contracts/world-constraints';

/** A stable stage, larger than the viewport; coordinates never depend on the device or render order. */
export const WORLD_EXTENT = { width: 6600, height: 4300 } as const;
export const WORLD_HOME = { x: 3300, y: 2150 } as const;

/**
 * Where each archipelago sits: a ring around the starting islands, close enough that the nearest
 * regions' names show from the start, far enough apart that no two archipelagos touch.
 */
const CENTERS: Record<Subject, readonly [number, number]> = {
  'sachunterricht-natur': [3300, 1100],
  mathe: [4400, 1950],
  'sachunterricht-gesellschaft': [4250, 3000],
  lernen: [3300, 2650],
  'sprachen-kunst': [2350, 3000],
  deutsch: [2350, 1950],
  zusammenleben: [1650, 1050],
};

/** The starting islands, side by side around home (the map opens here and the home card shows them). */
const NEAR_HOME: Readonly<Record<string, readonly [number, number]>> = {
  ueberraschungsinsel: [3300, 2150],
  zahlenwald: [3610, 1920],
  maerchenwald: [2990, 1920],
};

/** One island with its name needs about this much room; odd rows shift by half, like a honeycomb. */
const GRID = { x: 300, y: 270 } as const;
const RINGS = 3;

/** Honeycomb spots around a region's centre, nearest first: a compact archipelago without overlaps. */
const SPOTS: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: (2 * RINGS + 1) ** 2 },
  (_, index): readonly [number, number] => {
    const row = Math.floor(index / (2 * RINGS + 1)) - RINGS;
    const column = (index % (2 * RINGS + 1)) - RINGS;
    return [(column + (row % 2 === 0 ? 0 : 0.5)) * GRID.x, row * GRID.y];
  },
).sort(
  ([ax, ay], [bx, by]) =>
    Math.hypot(ax, ay) - Math.hypot(bx, by) || Math.atan2(ay, ax) - Math.atan2(by, bx),
);

const positions = new Map<string, { readonly x: number; readonly y: number }>();
const counts = new Map<Subject, number>();
for (const area of WORLD_AREAS) {
  const home = NEAR_HOME[area.id];
  if (home !== undefined) {
    positions.set(area.id, { x: home[0], y: home[1] });
    continue;
  }
  const index = counts.get(area.subject) ?? 0;
  counts.set(area.subject, index + 1);
  const [cx, cy] = CENTERS[area.subject];
  const [dx, dy] = SPOTS[index % SPOTS.length] ?? [0, 0];
  positions.set(area.id, { x: cx + dx, y: cy + dy });
}

/** How far a subject's banner floats above the highest of its islands' centres. */
const BANNER_LIFT = 230;
const FRAME_MARGIN = 80;

interface Point {
  readonly x: number;
  readonly y: number;
}

export interface SubjectRegion {
  /** Where the camera flies to show the subject's archipelago. */
  readonly center: Point;
  /** Where the archipelago's name floats, above its islands. */
  readonly banner: Point;
}

/** Each subject's archipelago, from its own islands (the starting islands near home excluded). */
export function subjectRegion(subject: Subject): SubjectRegion {
  const members = WORLD_AREAS.filter((area) => area.subject === subject && !(area.id in NEAR_HOME))
    .map((area) => positions.get(area.id))
    .filter(isDefined);
  if (members.length === 0) {
    return { center: WORLD_HOME, banner: { x: WORLD_HOME.x, y: WORLD_HOME.y - BANNER_LIFT } };
  }
  const x = members.reduce((sum, position) => sum + position.x, 0) / members.length;
  const top = Math.min(...members.map((position) => position.y));
  const bottom = Math.max(...members.map((position) => position.y));
  const banner = { x, y: top - BANNER_LIFT };
  // Framed from just above the banner down to the lowest island, so the name shows after a flight.
  return { center: { x, y: (banner.y - FRAME_MARGIN + bottom) / 2 }, banner };
}

/** Shared by the map and its preview; unknown ids stay reachable at the centre. */
export function worldPosition(areaId: string): { readonly x: number; readonly y: number } {
  return positions.get(areaId) ?? WORLD_HOME;
}
