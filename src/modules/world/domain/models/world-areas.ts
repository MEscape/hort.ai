/**
 * Hortai world areas: the fixed set an AI may classify a homework task into.
 * The AI returns only an `id`; the backend validates it against this list (`resolveArea`).
 * Names are German because the child sees them. Each area is drawn as one floating island; how it
 * looks lives in the presentation catalog (`presentation/catalog/islands.json`), keyed by `id`.
 */

export type Subject =
  | 'deutsch'
  | 'mathe'
  | 'sachunterricht-natur'
  | 'sachunterricht-gesellschaft'
  | 'sprachen-kunst'
  | 'zusammenleben'
  | 'lernen';

export interface WorldArea {
  /** Stable, never rename: it is the AI's answer, the route segment and the storage folder. */
  readonly id: string;
  /** Child-facing label (German). */
  readonly name: string;
  readonly subject: Subject;
  /** What falls into this area (English, for the classifier). */
  readonly topics: readonly string[];
  /** First and last grade where it usually appears. */
  readonly grades: readonly [number, number];
  /** Build these first. */
  readonly mvp?: boolean;
  /** Neutral reveal, route through the safety policy. */
  readonly sensitive?: boolean;
  /** Used when the AI is not confident. */
  readonly fallback?: boolean;
}

const SURPRISE_ISLAND = {
  id: 'ueberraschungsinsel',
  name: 'Überraschungsinsel',
  subject: 'lernen',
  topics: ['anything not confidently matched'],
  grades: [1, 4],
  mvp: true,
  fallback: true,
} as const satisfies WorldArea;

// One area per line keeps the list reviewable as a table.
// prettier-ignore
export const WORLD_AREAS = [
  // Deutsch
  { id: 'buchstabenberg', name: 'Buchstabenberg', subject: 'deutsch', topics: ['letters', 'sounds', 'learning to read'], grades: [1, 2] },
  { id: 'maerchenwald', name: 'Märchenwald', subject: 'deutsch', topics: ['reading', 'text comprehension', 'stories'], grades: [1, 4], mvp: true },
  { id: 'federsee', name: 'Federsee', subject: 'deutsch', topics: ['writing texts', 'stories', 'letters'], grades: [1, 4], mvp: true },
  { id: 'rechtschreib-werkstatt', name: 'Rechtschreib-Werkstatt', subject: 'deutsch', topics: ['spelling', 'dictation', 'practice words'], grades: [1, 4], mvp: true },
  { id: 'wortbaumhaus', name: 'Wortbaumhaus', subject: 'deutsch', topics: ['grammar', 'nouns', 'verbs', 'adjectives'], grades: [2, 4] },
  { id: 'reimtal', name: 'Reimtal', subject: 'deutsch', topics: ['poems', 'rhymes', 'songs'], grades: [1, 4] },
  { id: 'sprechbuehne', name: 'Sprechbühne', subject: 'deutsch', topics: ['presentations', 'retelling', 'speaking'], grades: [2, 4] },

  // Mathe
  { id: 'zahlenwald', name: 'Zahlenwald', subject: 'mathe', topics: ['counting', 'number range', 'adding', 'subtracting'], grades: [1, 4], mvp: true },
  { id: 'malmuehle', name: 'Malmühle', subject: 'mathe', topics: ['multiplication', 'times tables', 'dividing'], grades: [2, 4], mvp: true },
  { id: 'formenberge', name: 'Formenberge', subject: 'mathe', topics: ['shapes', 'solids', 'symmetry', 'geometry'], grades: [1, 4] },
  { id: 'messwerkstatt', name: 'Messwerkstatt', subject: 'mathe', topics: ['length', 'weight', 'volume', 'units'], grades: [2, 4] },
  { id: 'zeithaus', name: 'Zeithaus', subject: 'mathe', topics: ['clock', 'calendar', 'durations'], grades: [1, 3], mvp: true },
  { id: 'geldmarkt', name: 'Geldmarkt', subject: 'mathe', topics: ['euros and cents', 'shopping problems'], grades: [1, 3] },
  { id: 'obstgarten', name: 'Obstgarten', subject: 'mathe', topics: ['fractions', 'sharing', 'word problems'], grades: [2, 4], mvp: true },
  { id: 'mustertal', name: 'Mustertal', subject: 'mathe', topics: ['patterns', 'sequences', 'logic puzzles'], grades: [1, 4] },
  { id: 'diagrammdorf', name: 'Diagrammdorf', subject: 'mathe', topics: ['tables', 'charts', 'chance'], grades: [3, 4] },

  // Sachunterricht: nature and science
  { id: 'tierwiese', name: 'Tierwiese', subject: 'sachunterricht-natur', topics: ['animals', 'pets', 'farm animals'], grades: [1, 4], mvp: true },
  { id: 'waldwichtel-wald', name: 'Waldwichtel-Wald', subject: 'sachunterricht-natur', topics: ['forest', 'habitats', 'food chains'], grades: [2, 4] },
  { id: 'blumenwiese', name: 'Blumenwiese', subject: 'sachunterricht-natur', topics: ['plants', 'seeds', 'growing'], grades: [1, 4], mvp: true },
  { id: 'jahreszeitenhain', name: 'Jahreszeitenhain', subject: 'sachunterricht-natur', topics: ['seasons', 'months', 'nature through the year'], grades: [1, 3] },
  { id: 'wetterhuegel', name: 'Wetterhügel', subject: 'sachunterricht-natur', topics: ['weather', 'clouds', 'rain', 'wind'], grades: [1, 4] },
  { id: 'wasserteich', name: 'Wasserteich', subject: 'sachunterricht-natur', topics: ['water', 'water cycle', 'floating and sinking'], grades: [2, 4] },
  { id: 'steinhoehle', name: 'Steinhöhle', subject: 'sachunterricht-natur', topics: ['materials', 'magnets', 'simple experiments'], grades: [2, 4] },
  { id: 'echoschlucht', name: 'Echoschlucht', subject: 'sachunterricht-natur', topics: ['sound', 'hearing', 'light and shadow', 'air'], grades: [2, 4] },
  { id: 'feuerwache', name: 'Feuerwache', subject: 'sachunterricht-natur', topics: ['fire', 'fire safety', 'emergency call'], grades: [1, 4] },
  { id: 'strom-werkstatt', name: 'Strom-Werkstatt', subject: 'sachunterricht-natur', topics: ['electricity', 'simple machines', 'technology'], grades: [3, 4] },
  { id: 'roboterbucht', name: 'Roboterbucht', subject: 'sachunterricht-natur', topics: ['coding', 'algorithms', 'robots', 'step-by-step instructions'], grades: [2, 4] },
  { id: 'himmelsturm', name: 'Himmelsturm', subject: 'sachunterricht-natur', topics: ['sun', 'moon', 'planets', 'space'], grades: [2, 4] },
  { id: 'koerperhaus', name: 'Körperhaus', subject: 'sachunterricht-natur', topics: ['body', 'senses', 'teeth', 'sleep'], grades: [1, 4] },
  { id: 'kuechengarten', name: 'Küchengarten', subject: 'sachunterricht-natur', topics: ['healthy eating', 'where food comes from'], grades: [1, 4] },

  // Sachunterricht: people and places
  { id: 'kartenland', name: 'Kartenland', subject: 'sachunterricht-gesellschaft', topics: ['maps', 'directions', 'Germany', 'Europe'], grades: [2, 4] },
  { id: 'heimatstadt', name: 'Heimatstadt', subject: 'sachunterricht-gesellschaft', topics: ['neighbourhood', 'jobs', 'shops', 'buildings'], grades: [1, 4] },
  { id: 'verkehrsstrasse', name: 'Verkehrsstraße', subject: 'sachunterricht-gesellschaft', topics: ['traffic rules', 'bike test'], grades: [1, 4] },
  { id: 'zeitreise-tal', name: 'Zeitreise-Tal', subject: 'sachunterricht-gesellschaft', topics: ['history', 'then and now', 'Stone Age', 'knights'], grades: [3, 4] },
  { id: 'umweltpark', name: 'Umweltpark', subject: 'sachunterricht-gesellschaft', topics: ['environment', 'waste', 'saving energy'], grades: [2, 4] },
  { id: 'medienhuette', name: 'Medienhütte', subject: 'sachunterricht-gesellschaft', topics: ['internet', 'safe media use', 'TV and games'], grades: [3, 4] },
  { id: 'kinderrathaus', name: 'Kinderrathaus', subject: 'sachunterricht-gesellschaft', topics: ["children's rights", 'democracy', 'voting', 'class council'], grades: [3, 4] },

  // Languages, arts and others
  { id: 'hafen', name: 'Hafen', subject: 'sprachen-kunst', topics: ['English words', 'colors', 'numbers', 'simple sentences'], grades: [1, 4], mvp: true },
  { id: 'weltreise-hafen', name: 'Weltreise-Hafen', subject: 'sprachen-kunst', topics: ['other languages', 'other countries'], grades: [1, 4] },
  { id: 'musikwiese', name: 'Musikwiese', subject: 'sprachen-kunst', topics: ['music', 'instruments', 'notes', 'rhythm'], grades: [1, 4] },
  { id: 'farbtal', name: 'Farbtal', subject: 'sprachen-kunst', topics: ['drawing', 'painting', 'colors'], grades: [1, 4] },
  { id: 'bastelwerkstatt', name: 'Bastelwerkstatt', subject: 'sprachen-kunst', topics: ['crafts', 'making things', 'textiles'], grades: [1, 4] },
  { id: 'sportwiese', name: 'Sportwiese', subject: 'sprachen-kunst', topics: ['sports', 'rules', 'swimming', 'movement'], grades: [1, 4] },

  // Living together
  { id: 'freundschaftsdorf', name: 'Freundschaftsdorf', subject: 'zusammenleben', topics: ['feelings', 'rules', 'friends', 'conflicts'], grades: [1, 4], sensitive: true },
  { id: 'festetal', name: 'Festetal', subject: 'zusammenleben', topics: ['festivals', 'customs', 'religion and ethics', 'values'], grades: [1, 4], sensitive: true },

  // Study skills and catch-all
  { id: 'merkberg', name: 'Merkberg', subject: 'lernen', topics: ['study tricks', 'planning homework', 'concentration'], grades: [2, 4] },
  SURPRISE_ISLAND,
] as const satisfies readonly WorldArea[];

export type AreaId = (typeof WORLD_AREAS)[number]['id'];

export const FALLBACK_AREA_ID: AreaId = SURPRISE_ISLAND.id;

const AREA_BY_ID: ReadonlyMap<string, WorldArea> = new Map(WORLD_AREAS.map((a) => [a.id, a]));

/** Whether `id` names a world area (own entries only: `constructor` or `__proto__` are not). */
export function isAreaId(id: string): id is AreaId {
  return AREA_BY_ID.has(id);
}

/**
 * Validates whatever the AI returns. Unknown id, missing id or a confidence below `minConfidence`
 * (NaN included) leads to the fallback area, never to an error.
 */
export function resolveArea(
  aiId: string | undefined,
  confidence: number,
  minConfidence = 0.7,
): WorldArea {
  const hit = aiId === undefined ? undefined : AREA_BY_ID.get(aiId);
  return hit !== undefined && confidence >= minConfidence ? hit : SURPRISE_ISLAND;
}
