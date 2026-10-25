import { CHILD_SAFETY_VALIDATION_CODES } from '../errors/child-safety-errors';

import type { ChildSafetyValidationCode } from '../errors/child-safety-errors';
import type { SafetyScores } from '../ports/safety-classifier.port';

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

/**
 * Feedback is never punishing (#14): no verdict on the child, no blame for a mistake. "Noch nicht"
 * is fine; "falsch", "dumm" or "enttäuscht" are not. A false positive only costs one fallback.
 */
const DISCOURAGING_PATTERNS = [
  /\b(?:falsch|dumm\w*|faul\w*|schlecht\w*|peinlich\w*|enttäusch\w*|schäm\w*)\b/,
  /\bschon\s+wieder\b/,
  /\b(?:wrong|dumb|lazy|bad\s+job|disappoint\w*|ashamed)\b/,
];

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
  if (DISCOURAGING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    codes.push(CHILD_SAFETY_VALIDATION_CODES.discouraging);
  }
  return codes;
}

/**
 * A classifier score at or above this flags the rule. Low on purpose: a false positive only costs
 * one fallback prompt, a false negative reaches a child.
 */
const SAFETY_FLAG_THRESHOLD = 0.5;

/**
 * The rules a safety classifier flags. A score outside 0 to 1 (or not a number) is untrusted
 * output and flags the rule too.
 */
export function flaggedBySafetyScores(scores: SafetyScores): ChildSafetyValidationCode[] {
  return Object.values(CHILD_SAFETY_VALIDATION_CODES).filter((code) => {
    const score = scores[code];
    if (score === undefined) {
      return false;
    }
    return !(Number.isFinite(score) && score >= 0 && score <= 1) || score >= SAFETY_FLAG_THRESHOLD;
  });
}
