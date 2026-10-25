import type { CurriculumSubject } from '../models/curriculum-scope';

interface Concept {
  /** Matched against the lower-cased task text. */
  readonly signal: RegExp;
  /** Words the curriculum uses for the same idea; added to the task's own words. */
  readonly terms: string;
}

/**
 * Primary-school maths vocabulary (#28). A child's task says "verteilt gerecht" or "347 + 256";
 * the curriculum says "Division" and "schriftliche Verfahren". This table bridges the two without a
 * paid embedding service. It is per subject, not per state: a new state needs no change here.
 */
const MATH_CONCEPTS: readonly Concept[] = [
  {
    signal: /\d\s*\+\s*\d|\bplus\b|addier|zusammenrechn|zusammen\b/,
    terms: 'addition rechenverfahren rechenstrategien grundrechenarten schriftlich halbschriftlich',
  },
  {
    signal: /\d\s*[-−]\s*\d|\bminus\b|subtrahier|weniger|abzieh/,
    terms:
      'subtraktion rechenverfahren rechenstrategien grundrechenarten schriftlich halbschriftlich',
  },
  {
    signal: /\d\s*[·×*]\s*\d|\bmal\b|multiplizier|\bje\b|jeweils|kauft\s+\d/,
    terms: 'multiplikation einmaleins grundrechenarten rechenoperationen',
  },
  {
    // "36 : 4" is a division, "15:45" (no spaces) a clock time.
    signal: /\d\s+:\s+\d|÷|geteilt|dividier|verteil|gerecht|aufteil/,
    terms: 'division umkehroperationen grundrechenarten rechenoperationen operationsverständnis',
  },
  {
    signal: /€|\beuro\b|\bct\b|\bcent\b|kostet|bezahl|preis|\bgeld/,
    terms: 'geldwerte größen messen sachsituationen',
  },
  {
    signal: /\buhr\b|minute|stunde|sekunde|dauer|beginnt|endet|\d{1,2}:\d{2}/,
    terms: 'zeitspannen größen messen',
  },
  {
    signal: /\b(?:mm|cm|km|kg|ml)\b|\d\s*(?:m|g|l)\b|meter|gramm|liter|gewicht|wiegt|schwer/,
    terms: 'längen gewichte massen hohlmaße größen messen',
  },
  {
    signal: /folge|fortsetz|setze.*fort|muster|regel|reihe|_{2,}|…|\.\.\./,
    terms: 'muster gesetzmäßigkeiten zahlenfolgen strukturen arithmetische',
  },
  {
    signal:
      /dreieck|viereck|quadrat|rechteck|kreis|würfel\b|quader|kugel|spiegel|symmetr|umfang|fläche/,
    terms: 'figuren geometrische körper raum form achsensymmetrie flächeninhalt umfang',
  },
  {
    signal:
      /tabelle|diagramm|schaubild|strichliste|würfeln|wahrscheinlich|zufall|münze|möglichkeiten/,
    terms: 'daten diagramme tabellen zufallsexperimenten wahrscheinlichkeit kombinatorische',
  },
  {
    signal: /\d{3,}/,
    terms: 'zahlenraum stellenwertsystem zahldarstellung',
  },
];

/** A question about a situation ("Wie viele … bekommt jedes Kind?") is a word problem. */
const WORD_PROBLEM_TERMS =
  'sachaufgaben sachsituationen sachprobleme sachtexten sachzusammenhängen informationen';
const WORD_PROBLEM_MIN_WORDS = 8;

const CONCEPTS_BY_SUBJECT: Readonly<Record<CurriculumSubject, readonly Concept[]>> = {
  math: MATH_CONCEPTS,
  german: [],
  general_studies: [],
  english: [],
};

/** The curriculum words a task implies beyond its own (empty for a subject without a table). */
export function conceptTermsOf(task: string, subject: CurriculumSubject): string[] {
  const text = task.toLowerCase();
  const terms = CONCEPTS_BY_SUBJECT[subject]
    .filter((concept) => concept.signal.test(text))
    .map((concept) => concept.terms);
  const words = text.split(/\s+/).filter((word) => word.length > 0).length;
  if (subject === 'math' && text.includes('?') && words >= WORD_PROBLEM_MIN_WORDS) {
    terms.push(WORD_PROBLEM_TERMS);
  }
  return terms
    .join(' ')
    .split(' ')
    .filter((term) => term.length > 0);
}
