import { CHILD_SAFETY_VALIDATION_CODES } from '../errors/child-safety-errors';

import type { ChildSafetyValidationCode } from '../errors/child-safety-errors';

/**
 * A homework companion never needs to know who or where the child is. These catch the AI asking for
 * it, in German and English: name, age, address, school, phone, e-mail, password, a photo, a meeting,
 * or when the child is alone.
 */
const PERSONAL_DATA_PATTERNS = [
  /\bwie\s+hei(?:ß|ss)t\s+du\b/,
  /\bwie\s+alt\s+bist\s+du\b/,
  /\bwo\s+wohnst\s+du\b/,
  /\b(?:auf|in)\s+welche\s+schule\b/,
  /\bdein(?:e|en|er)?\s+(?:vollständigen?\s+)?(?:nachnamen?|adresse|anschrift|wohnort|(?:handy|telefon)nummer|e-?mail|passwort|geburtstag)\b/,
  /\b(?:schick|sende|zeig)\w*\s+(?:mir\s+)?(?:doch\s+)?(?:ein(?:\s+|e\s+)?)?(?:foto|bild|selfie|video)\b/,
  /\b(?:treffen|sehen)\s+wir\s+uns\b/,
  /\bbist\s+du\s+(?:gerade\s+)?allein\b/,
  /\b(?:what(?:'s|\s+is)\s+your\s+(?:name|address|phone|email|school|password))\b/,
  /\bwhere\s+do\s+you\s+live\b/,
  /\bsend\s+(?:me\s+)?(?:a\s+)?(?:photo|picture|selfie)\b/,
];

/** Grooming starts with secrets: the AI must never ask the child to hide anything from their parents. */
const SECRECY_PATTERNS = [
  /\b(?:sag|erzähl)\w*\s+(?:es\s+|das\s+)?(?:niemandem|keinem|nicht\s+deinen\s+eltern)\b/,
  /\bunser(?:\s+kleines)?\s+geheimnis\b/,
  /\bdeine[n]?\s+eltern\s+(?:müssen|brauchen)\s+(?:das\s+)?nichts?\b/,
  /\b(?:don't|do\s+not)\s+tell\s+(?:anyone|your\s+parents)\b/,
  /\bour\s+(?:little\s+)?secret\b/,
];

/**
 * Words that never belong in help for a child: insults, violence, sexual content, drugs. A short
 * starting list (owned by the backend lead, see #11); a false positive only costs one fallback prompt.
 */
const INAPPROPRIATE_WORDS =
  /\b(?:idiot\w*|versager\w*|hässlich\w*|bescheuert\w*|umbring\w*|umgebracht|töte\w*|nackt\w*|sex\w*|porno\w*|drogen?|stupid|loser|kill\w*|naked|porn\w*|drugs?)\b/;

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');

/**
 * Checks AI text that already met the output contract against the child-safety rules (#11) and
 * returns every violation (none when the text may be shown). Runs after `validateAiOutput`, which
 * already rejects links, markup and code. The solution-leak guard is #31.
 */
export function checkChildSafeText(text: string): ChildSafetyValidationCode[] {
  const normalized = normalize(text);
  const codes: ChildSafetyValidationCode[] = [];
  if (PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(normalized))) {
    codes.push(CHILD_SAFETY_VALIDATION_CODES.asksForPersonalData);
  }
  if (SECRECY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    codes.push(CHILD_SAFETY_VALIDATION_CODES.asksForSecrecy);
  }
  if (INAPPROPRIATE_WORDS.test(normalized)) {
    codes.push(CHILD_SAFETY_VALIDATION_CODES.inappropriateContent);
  }
  return codes;
}
