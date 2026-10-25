/**
 * The pure rules of `npm run world:assets`: in which order islands are generated, what each
 * generation is asked for, and whether a generated master can become the delivered pictures.
 * The art direction and the workflow are in `docs/architecture/world.md`.
 */

/**
 * The canonical art direction, word for word the first part of every island prompt: the same camera,
 * framing, light and material for every island, so islands generated at different times still belong
 * to one world. Change it only on purpose: it changes every island generated afterwards.
 */
export const STYLE_PROMPT = [
  'Original 3D miniature diorama illustration of one small floating island for a German primary-school homework app (children aged 6 to 10). Part of one consistent series: every island of the series shares exactly this camera, framing, light and material.',
  'CAMERA: fixed three-quarter front view, slightly elevated (about 35 degrees looking down), near-orthographic with very little perspective distortion. The island is centred and faces the viewer; the same camera for every island.',
  "FRAMING: 4:3 landscape canvas. The island's top surface spans about 80% of the width and is centred horizontally. The tallest landmark ends about 5% below the top edge; the lowest tip of the hanging rock ends about 92% down. Nothing touches or crosses the canvas edges.",
  'ISLAND: a rounded, organic top surface in the biome of the brief, a thin visible band of soil under its front edge, and an underside of layered, rounded rock that tapers to one soft point, so the island clearly floats. The outline is irregular and characterful, not an ellipse. No waterfalls off the edge unless the brief asks for one.',
  'HIERARCHY: one signature landmark at the back centre, clearly the largest object. Two to four supporting places on the left, the right and the front, exactly as the brief places them, each readable on its own. Two or three small footpaths lead from the places to the landmark. Only a few small environmental details; leave calm open ground between the places for later additions.',
  'LIGHT: soft warm key light from the top left, gentle ambient occlusion, a soft contact shadow under every object. No harsh specular highlights, no rim light, no dramatic or dark shadows.',
  'MATERIAL: matte and softly textured, a handcrafted clay and painted-wood feel. Simplified, rounded geometry with softened edges; tidy and readable even as a small thumbnail.',
  'PALETTE: warm, slightly muted, harmonious colours on a creamy warm base. Brand anchors: chestnut brown #7b421f, owl amber #ffae2b, terracotta #e4a17b, book blue #d1e5ef, cream #fff8f0. Biome colours as the brief describes them, at the same saturation. No neon, no pure black.',
  'MOOD: cosy, calm, inviting, curious and safe. Never dark, scary, aggressive, photorealistic or babyish clip art.',
  'BACKGROUND: fully transparent (alpha channel). No sky, no clouds behind the island, no ground plane, no frame, no vignette.',
  "FORBIDDEN: any text, letters, words, numbers or numerals, symbols that read as writing, logos, real countries' flags, religious symbols, signatures and watermarks. No people. Animals only where the brief asks, cute and simple. Do not copy any existing game, film, character or brand.",
].join('\n\n');

/**
 * Three substantially different islands (maths forest, German lake, nature-and-space twilight),
 * generated and approved first. One of them becomes `reference.png` in the working folder, the
 * style reference attached to every later generation, so a new island cannot redefine the look.
 */
export const COHESION_SET = ['zahlenwald', 'federsee', 'himmelsturm'] as const;

/** The widest delivered variant; a master must hold at least this many pixels (4:3). */
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 768;

interface OrderedArea {
  readonly id: string;
  readonly mvp?: boolean;
}

/** Cohesion set first, then the MVP areas, then the rest, each in the order of `WORLD_AREAS`. */
export function generationOrder<T extends OrderedArea>(areas: readonly T[]): readonly T[] {
  const cohesion = new Set<string>(COHESION_SET);
  const rank = (area: T) => {
    if (cohesion.has(area.id)) {
      return 0;
    }
    return area.mvp === true ? 1 : 2;
  };
  return areas
    .map((area, index) => ({ area, index }))
    .sort((a, b) => rank(a.area) - rank(b.area) || a.index - b.index)
    .map(({ area }) => area);
}

interface PromptArea {
  readonly topics: readonly string[];
  readonly grades: readonly [number, number];
  readonly sensitive?: boolean;
}

/**
 * The full prompt of one asset: the shared style, the asset's brief, and context the model must
 * not write into the picture. The German area name is left out on purpose: a name in a prompt
 * invites lettering.
 */
export function composePrompt(style: string, area: PromptArea, brief: string): string {
  const context = [
    `CONTEXT (do not write it into the picture): homework about ${area.topics.join(', ')}, grades ${area.grades[0]} to ${area.grades[1]}.`,
    ...(area.sensitive === true
      ? ['This learning area is sensitive: keep every detail neutral, inclusive and calm.']
      : []),
  ];
  return `${style.trim()}\n\nBRIEF:\n${brief.trim()}\n\n${context.join('\n')}\n`;
}

interface MasterMetadata {
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly hasAlpha?: boolean | undefined;
}

/** What keeps a generated master from becoming the delivered pictures; empty when it can. */
export function masterIssues({ width, height, hasAlpha }: MasterMetadata): readonly string[] {
  if (width === undefined || height === undefined) {
    return ['not a readable picture'];
  }
  return [
    ...(hasAlpha === true ? [] : ['no transparency: remove the background first']),
    ...(width >= MIN_WIDTH && height >= MIN_HEIGHT
      ? []
      : [`too small: needs at least ${MIN_WIDTH} × ${MIN_HEIGHT}`]),
  ];
}
