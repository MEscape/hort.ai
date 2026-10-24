/**
 * Words that carry no subject meaning in a task or a competency. Compared after lower-casing,
 * before stemming.
 */
const STOPWORDS = new Set(
  (
    'der die das den dem des ein eine einer eines einem einen und oder aber zu zum zur von vom mit ' +
    'auf an am in im ins ist sind war hat haben wird werden wie viele viel was wer wem wen wann wo ' +
    'warum sie er es ich du wir ihr ihm ihn ihre sein seine für bei aus nach auch sowie dabei diese ' +
    'dieser dieses diesen können kann soll sollen muss müssen lernenden schülerinnen schüler jedes ' +
    'jede jeder ob als so dass da dann noch nur nicht kein keine z b u a ggf etc bzw jahrgangsstufe'
  ).split(' '),
);

const SUFFIXES = ['ungen', 'ungs', 'ung', 'ern', 'en', 'er', 'es', 'em', 'e', 'n', 's'];
const MIN_STEM = 4;

/** A crude German stem: lower case, `ß` as `ss`, one common inflection suffix removed. */
export function stem(word: string): string {
  const lower = word.toLowerCase().replace(/ß/g, 'ss');
  for (const suffix of SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length - suffix.length >= MIN_STEM) {
      return lower.slice(0, -suffix.length);
    }
  }
  return lower;
}

/** The stems of the meaningful words of a text. */
export function termsOf(text: string): Set<string> {
  const terms = new Set<string>();
  for (const word of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length >= 3 && !STOPWORDS.has(word) && !/^\d+$/.test(word)) {
      terms.add(stem(word));
    }
  }
  return terms;
}

/** Two stems match when equal, or when one starts or contains the other and is long enough. */
export function stemsMatch(query: string, candidate: string): boolean {
  if (query === candidate) {
    return true;
  }
  const [short, long] = query.length <= candidate.length ? [query, candidate] : [candidate, query];
  return short.length >= 5 && (long.startsWith(short) || (short.length >= 6 && long.includes(short)));
}
