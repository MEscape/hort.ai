/** Providers most people in the platform's market use; a typo of one of these is worth a question. */
const KNOWN_DOMAINS = [
  'gmail.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'outlook.com',
  'outlook.de',
  'hotmail.com',
  'hotmail.de',
  'yahoo.com',
  'yahoo.de',
  'icloud.com',
  't-online.de',
  'freenet.de',
  'posteo.de',
] as const;

/** Whether `shorter` is `longer` with one character left out. */
function isOneLeftOut(shorter: string, longer: string): boolean {
  return Array.from(longer).some((_, at) => longer.slice(0, at) + longer.slice(at + 1) === shorter);
}

/** Whether two strings are one slip apart: a letter too many, too few, wrong, or two neighbours swapped. */
function isOneSlipApart(a: string, b: string): boolean {
  if (a.length === b.length) {
    const differing = Array.from(a, (letter, at) => (letter === b.charAt(at) ? -1 : at)).filter(
      (at) => at !== -1,
    );
    const [first, second] = differing;
    if (differing.length === 1) {
      return true;
    }
    return (
      differing.length === 2 &&
      first !== undefined &&
      second === first + 1 &&
      a.charAt(first) === b.charAt(second) &&
      a.charAt(second) === b.charAt(first)
    );
  }
  if (Math.abs(a.length - b.length) !== 1) {
    return false;
  }
  return a.length < b.length ? isOneLeftOut(a, b) : isOneLeftOut(b, a);
}

/**
 * The address the person probably meant, when the domain is one letter away
 * from a well-known provider ("anna@gmial.com" gives "anna@gmail.com"), or
 * `null`. Only a question: a domain nobody knows is left alone, since
 * municipalities have their own.
 */
export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) {
    return null;
  }
  const domain = trimmed.slice(at + 1).toLowerCase();
  if ((KNOWN_DOMAINS as readonly string[]).includes(domain)) {
    return null;
  }
  const match = KNOWN_DOMAINS.find((known) => isOneSlipApart(domain, known));
  return match === undefined ? null : `${trimmed.slice(0, at)}@${match}`;
}
