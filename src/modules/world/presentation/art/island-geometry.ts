/**
 * The outline of a drawn placeholder island, derived only from its seed (the area id), so an
 * island looks the same on every screen and every render, and no two areas share a silhouette.
 * Coordinates are in the 4:3 canvas of every island picture (`ISLAND_VIEWBOX`, the same framing as
 * the 2048 × 1536 masters), so a place's `x`/`y` fraction lands on the same spot in both.
 */

export const ISLAND_VIEWBOX = { width: 400, height: 300 } as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface IslandOutline {
  /** The grassy top, seen from slightly above. */
  readonly top: string;
  /** The top shrunk towards its middle: the biome's inner ground. */
  readonly inner: string;
  /** The top pushed down: the band of soil under its front edge. */
  readonly side: string;
  /** The hanging rock below. */
  readonly underside: string;
  /** The right half of the rock, away from the light (top left). */
  readonly shade: string;
  /** One rock layer line across the underside. */
  readonly strata: string;
}

/** Where the signature landmark stands: back centre of the top. */
export const LANDMARK_POINT: Point = { x: 200, y: 98 };

/**
 * Spots near the rim, inside even the narrowest outline, where the biome's small scenery (trees,
 * flowers, stones) may stand. A spot next to a place stays free, so a place is never hidden.
 */
const SCENERY_POINTS: readonly Point[] = [
  { x: 92, y: 128 },
  { x: 122, y: 96 },
  { x: 168, y: 74 },
  { x: 234, y: 76 },
  { x: 282, y: 94 },
  { x: 314, y: 126 },
  { x: 150, y: 180 },
  { x: 250, y: 180 },
];

const CENTER: Point = { x: 200, y: 128 };
const RADIUS_X = 158;
const RADIUS_Y = 64;
const SIDE_DEPTH = 18;
const RING_POINTS = 24;

/** FNV-1a: a stable 32-bit number for a seed text. */
function hashOf(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: a small deterministic random sequence in [0, 1). */
function randomOf(seed: string): () => number {
  let state = hashOf(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value * 10) / 10;
const at = (points: readonly Point[], index: number): Point =>
  points[(index + points.length) % points.length] ?? CENTER;

/** A smooth path through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(points: readonly Point[], isClosed: boolean): string {
  const first = at(points, 0);
  const segments = isClosed ? points.length : points.length - 1;
  let path = `M${round(first.x)} ${round(first.y)}`;
  for (let index = 0; index < segments; index += 1) {
    const before = isClosed || index > 0 ? at(points, index - 1) : at(points, index);
    const from = at(points, index);
    const to = at(points, index + 1);
    const after = isClosed || index + 2 < points.length ? at(points, index + 2) : to;
    path +=
      `C${round(from.x + (to.x - before.x) / 6)} ${round(from.y + (to.y - before.y) / 6)} ` +
      `${round(to.x - (after.x - from.x) / 6)} ${round(to.y - (after.y - from.y) / 6)} ` +
      `${round(to.x)} ${round(to.y)}`;
  }
  return isClosed ? `${path}Z` : path;
}

const shifted = (points: readonly Point[], dy: number) =>
  points.map((point) => ({ x: point.x, y: point.y + dy }));

const scaled = (points: readonly Point[], factor: number, origin: Point) =>
  points.map((point) => ({
    x: origin.x + (point.x - origin.x) * factor,
    y: origin.y + (point.y - origin.y) * factor,
  }));

export function islandOutline(seed: string): IslandOutline {
  const random = randomOf(seed);
  const waves = [
    [2, 0.08],
    [3, 0.06],
    [5, 0.035],
  ].map(([frequency = 0, maxAmplitude = 0]) => ({
    frequency,
    amplitude: random() * maxAmplitude,
    phase: random() * Math.PI * 2,
  }));
  const radiusX = RADIUS_X * (0.9 + random() * 0.1);
  const ring = Array.from({ length: RING_POINTS }, (_, index) => {
    const angle = (index / RING_POINTS) * Math.PI * 2;
    const radius = waves.reduce(
      (sum, wave) => sum + wave.amplitude * Math.sin(wave.frequency * angle + wave.phase),
      1,
    );
    return {
      x: CENTER.x + radiusX * radius * Math.cos(angle),
      y: CENTER.y + RADIUS_Y * radius * Math.sin(angle),
    };
  });

  // From the right end (angle 0) along the front to the left end (angle π).
  const front = shifted(ring.slice(0, RING_POINTS / 2 + 1), SIDE_DEPTH);
  const base = CENTER.y + SIDE_DEPTH;
  const jitter = (spread: number) => random() * spread;
  const lowerLeft = { x: CENTER.x - radiusX * (0.55 + jitter(0.1)), y: base + 34 + jitter(10) };
  const lowerMidLeft = { x: CENTER.x - radiusX * (0.25 + jitter(0.1)), y: base + 76 + jitter(12) };
  const tip = { x: CENTER.x + (random() - 0.5) * radiusX * 0.25, y: base + 118 + jitter(14) };
  const lowerMidRight = { x: CENTER.x + radiusX * (0.22 + jitter(0.1)), y: base + 74 + jitter(12) };
  const lowerRight = { x: CENTER.x + radiusX * (0.52 + jitter(0.1)), y: base + 32 + jitter(10) };
  const middle = front[RING_POINTS / 4] ?? CENTER;

  return {
    top: smoothPath(ring, true),
    inner: smoothPath(scaled(ring, 0.78, { x: CENTER.x, y: CENTER.y - 6 }), true),
    side: smoothPath(shifted(ring, SIDE_DEPTH), true),
    underside: smoothPath(
      [...front, lowerLeft, lowerMidLeft, tip, lowerMidRight, lowerRight],
      true,
    ),
    shade: smoothPath(
      [
        ...front.slice(0, RING_POINTS / 4 + 1).reverse(),
        lowerRight,
        lowerMidRight,
        tip,
        { x: (tip.x + middle.x) / 2 + 8, y: (tip.y + middle.y) / 2 },
      ],
      true,
    ),
    // Inside the rock: from just within its left shoulder, under the middle, to the right one.
    strata: smoothPath(
      [
        { x: lowerLeft.x + 16, y: lowerLeft.y + 6 },
        { x: CENTER.x, y: base + 48 },
        { x: lowerRight.x - 16, y: lowerRight.y + 6 },
      ],
      false,
    ),
  };
}

const SCENERY_CLEARANCE = 40;

/** The scenery spots that are not next to one of the island's places. */
export function freeSceneryPoints(places: readonly Point[]): readonly Point[] {
  return SCENERY_POINTS.filter((spot) =>
    places.every((place) => Math.hypot(place.x - spot.x, place.y - spot.y) > SCENERY_CLEARANCE),
  );
}

/** A gently bent trail between two points on the top. */
export function trailPath(from: Point, to: Point): string {
  const bend = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.35, y: (from.y + to.y) / 2 };
  return `M${round(from.x)} ${round(from.y)}Q${round(bend.x)} ${round(bend.y)} ${round(to.x)} ${round(to.y)}`;
}
