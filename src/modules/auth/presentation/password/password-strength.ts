import { CREDENTIAL_LIMITS } from '../../application/contracts/auth-constraints';

/** 0 while nothing is typed, then weak to strong. */
export const STRENGTH = { none: 0, weak: 1, fair: 2, good: 3, strong: 4 } as const;
export type StrengthLevel = (typeof STRENGTH)[keyof typeof STRENGTH];

export interface PasswordAssessment {
  readonly level: StrengthLevel;
  /** The one rule the server enforces: the length. */
  readonly isLongEnough: boolean;
  /** Not a well-known password or a bare pattern (a run of keys, one repeated character). */
  readonly isNotCommon: boolean;
  /** Free of the person's own name and address; `null` while there is nothing to compare with. */
  readonly avoidsPersonalInfo: boolean | null;
}

/**
 * Advice for the person choosing a password, never a rule: the server only
 * enforces the length (`CREDENTIAL_LIMITS`), because composition rules push
 * people toward predictable passwords. So the rating is led by length, with a
 * little credit for mixing kinds of characters, and it discounts repeats, runs
 * of neighbouring characters and anything built from known words or the
 * person's own details. It grows a step at a time as the password does.
 */
const COMMON_WORDS = [
  'password',
  'passwort',
  'passwd',
  'qwertz',
  'qwerty',
  'letmein',
  'welcome',
  'willkommen',
  'iloveyou',
  'changeme',
  'admin',
  'login',
  'hallo',
  'sommer',
  'winter',
  'fussball',
  'master',
  'dragon',
  'monkey',
  'abc',
  'test',
] as const;

/** Keyboard rows (German and English): neighbours on one are as guessable as 1-2-3. */
const KEYBOARD_ROWS = ['1234567890', 'qwertzuiop', 'qwertyuiop', 'asdfghjkl', 'yxcvbnm', 'zxcvbnm'];

const MIN_PART_LENGTH = 3;
/** Each kind of character beyond the first is worth this many characters of length. */
const CLASS_BONUS = 2;
/** The score (characters that count, plus the bonus) from which each level above weak is reached. */
const SCORE_FOR_LEVEL = { 2: CREDENTIAL_LIMITS.passwordMin, 3: 17, 4: 22 } as const;
/** A password that echoes the person's details never rates above this. */
const MAX_PERSONAL_LEVEL = 2;

function isNeighbour(a: string, b: string): boolean {
  if (Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) === 1) {
    return true;
  }
  return KEYBOARD_ROWS.some((row) => {
    const at = row.indexOf(a);
    return at !== -1 && Math.abs(at - row.indexOf(b)) === 1;
  });
}

/**
 * Characters that add nothing new: those in a run of three or more where each
 * is a repeat of the one before or its neighbour on the keyboard or in the
 * alphabet ("aaaa", "abcd", "asdf"). A single such pair is chance, not a pattern.
 */
function predictableCount(lower: string): number {
  let count = 0;
  let run = 0;
  for (let index = 1; index <= lower.length; index += 1) {
    const previous = lower.charAt(index - 1);
    const current = lower.charAt(index);
    if (index < lower.length && (current === previous || isNeighbour(previous, current))) {
      run += 1;
      continue;
    }
    if (run >= 2) {
      count += run;
    }
    run = 0;
  }
  return count;
}

/** How many kinds of character are in use: lower case, upper case, digits, anything else. */
function classCountOf(password: string): number {
  return [/[a-z]/u, /[A-Z]/u, /\d/u, /[^a-zA-Z\d]/u].filter((kind) => kind.test(password)).length;
}

/** Whether the password is nothing but known words, digits, symbols and bare patterns. */
function isCommonPassword(password: string, lower: string): boolean {
  let rest = lower;
  for (const word of COMMON_WORDS) {
    rest = rest.replaceAll(word, '');
  }
  const letters = rest.replaceAll(/[^a-z]/gu, '');
  const isOnlyKnownWords = letters.length === 0 && /[a-z]/u.test(lower);
  const isOneCharacter = new Set(password).size === 1;
  const isPureRun = lower.length > 1 && predictableCount(lower) === lower.length - 1;
  return isOnlyKnownWords || isOneCharacter || isPureRun;
}

/** The parts of the person's details worth looking for: words of three or more characters. */
function personalPartsOf(inputs: readonly string[]): string[] {
  return inputs.flatMap((input) =>
    input
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((part) => part.length >= MIN_PART_LENGTH),
  );
}

function levelOf(score: number): StrengthLevel {
  if (score >= SCORE_FOR_LEVEL[STRENGTH.strong]) {
    return STRENGTH.strong;
  }
  if (score >= SCORE_FOR_LEVEL[STRENGTH.good]) {
    return STRENGTH.good;
  }
  return score >= SCORE_FOR_LEVEL[STRENGTH.fair] ? STRENGTH.fair : STRENGTH.weak;
}

/**
 * Rates a password being typed. `personalInputs` are the details it should
 * not echo (the email address, the name); they never leave the browser.
 */
export function assessPassword(
  password: string,
  personalInputs: readonly string[] = [],
): PasswordAssessment {
  const lower = password.toLowerCase();
  const parts = personalPartsOf(personalInputs);
  const isLongEnough = password.length >= CREDENTIAL_LIMITS.passwordMin;
  const isNotCommon = password.length === 0 || !isCommonPassword(password, lower);
  const avoidsPersonalInfo =
    parts.length === 0 ? null : !parts.some((part) => lower.includes(part));

  if (password.length === 0) {
    return { level: 0, isLongEnough, isNotCommon, avoidsPersonalInfo };
  }
  // Under the minimum the password is refused anyway, and a known one is never better than weak.
  if (!isLongEnough || !isNotCommon) {
    return { level: 1, isLongEnough, isNotCommon, avoidsPersonalInfo };
  }

  const counted = password.length - predictableCount(lower);
  const score = counted + (classCountOf(password) - 1) * CLASS_BONUS;
  const level = levelOf(score);

  return {
    level: avoidsPersonalInfo === false && level > MAX_PERSONAL_LEVEL ? MAX_PERSONAL_LEVEL : level,
    isLongEnough,
    isNotCommon,
    avoidsPersonalInfo,
  };
}
