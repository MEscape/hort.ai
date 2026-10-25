const PEOPLE =
  '(?:papa|mama|vater|mutter|stief\\w+|onkel|tante|bruder|schwester|opa|oma|lehrer\\w*|nachbar\\w*|dad|mom|mum|father|mother|step\\w+|uncle|aunt|brother|sister|teacher|neighbou?r)';

/**
 * What a child of grades 1 to 4 says when someone hurts them, they are bullied, they want to hurt
 * themselves or are told to keep it secret, in German and English. First person only, so homework
 * about a knight who hits a dragon passes. A false positive only shows the trusted-adult notice.
 */
const DISTRESS_PATTERNS = [
  /\b(?:schlägt|haut|tritt|verprügelt|würgt|bedroht|beißt|fasst)\s+mich\b/,
  /\btut\s+mir\s+weh\b/,
  /\bwerde\s+(?:\w+\s+){0,4}(?:geschlagen|gemobbt|verprügelt|bedroht|angefasst)\b/,
  /\bmobb\w*\s+mich\b/,
  /\b(?:will|möchte)\s+(?:nicht\s+mehr\s+leben|sterben|tot\s+sein)\b/,
  /\bmich\s+(?:selbst\s+)?(?:umbringen|ritzen|verletzen)\b/,
  /\bmir\s+(?:selbst\s+)?(?:wehtun|weh\s+tun|was\s+antun|etwas\s+antun)\b/,
  /\b(?:darf|soll)\s+(?:es|das)\s+niemandem\s+(?:sagen|erzählen)\b/,
  new RegExp(`\\bangst\\s+vor\\s+(?:meine[mnr]?|dem|der)\\s+${PEOPLE}\\b`),
  /\b(?:hits|beats|hurts|touches|kicks|chokes)\s+me\b/,
  /\bis\s+hurting\s+me\b/,
  /\bwant\s+to\s+(?:die|kill\s+myself|hurt\s+myself)\b/,
  /\bkill\s+myself\b/,
  /\b(?:am|being|get|getting)\s+(?:being\s+)?bullied\b/,
  /\bnot\s+allowed\s+to\s+tell\s+anyone\b/,
  new RegExp(`\\b(?:scared|afraid)\\s+of\\s+my\\s+${PEOPLE}\\b`),
];

const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');

/**
 * Whether the child's own words (a task, an answer, a reply) say they may be in danger (#90). Runs
 * before any AI sees the text: a hit is answered with a fixed notice to talk to a trusted adult,
 * never with homework help or a cheerful redirect.
 */
export function detectsChildDistress(text: string): boolean {
  const normalized = normalize(text);
  return DISTRESS_PATTERNS.some((pattern) => pattern.test(normalized));
}
