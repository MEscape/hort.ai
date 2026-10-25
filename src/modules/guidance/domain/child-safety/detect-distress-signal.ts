/**
 * What a child's message clearly signals (#90): thoughts of dying or hurting themselves, violence or
 * abuse against them, or acute danger. Only the category is ever logged, never the text.
 */
export type DistressCategory = 'self_harm' | 'violence_or_abuse' | 'acute_danger';

/**
 * Lower case, umlauts and ß spelled out (so "möchte", "moechte" and "mochte" meet), apostrophes
 * dropped ("don't" -> "dont"), every other punctuation mark a space, whitespace collapsed. The
 * phrases below are written in this form.
 */
export function normalizeForDistress(text: string): string {
  return ` ${text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/['’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

/* Small, careful typo tolerance: a missing space, a dropped letter in the most common words. */
const WANT = String.raw`(?:will|wil|moechte|mochte|mag|wuerde\s+gern|wuerde\s+lieber)`;
const NOT_ANYMORE = String.raw`nicht\s*mehr`;
/** Adults a child depends on or meets alone; siblings and classmates are covered as a group below. */
const ADULT = String.raw`(?:papa|papi|vater|mama|mami|mutter|stiefvater|stiefmutter|stiefpapa|stiefmama|onkel|tante|opa|oma|lehrer|lehrerin|trainer|trainerin|nachbar|nachbarin|betreuer|betreuerin|freund\s+von\s+mama|freund\s+von\s+papa|freund\s+meiner\s+mutter|freundin\s+von\s+papa)`;
const HURTS = String.raw`(?:schlaegt|schlagt|haut|verhaut|pruegelt|verpruegelt|tritt|wuergt|quaelt|missbraucht|vergewaltigt)`;
const HURT_PLURAL = String.raw`(?:schlagen|hauen|verhauen|pruegeln|verpruegeln|treten|quaelen)`;
/** Words between "ich werde" and the verb, but never a game's "beim", "bei", "im" or "in". */
const NOT_A_GAME_WORDS = String.raw`(?:(?!(?:beim|bei|im|in)\b)\w+\s+){0,4}`;
/** "Papa schlägt mich beim Schach" is a game, not violence. */
const NOT_A_GAME = String.raw`(?!\s+(?:\w+\s+)?(?:beim|bei|im|in|an|auf|um)\b)`;
const EN_ADULT = String.raw`(?:dad|daddy|father|mum|mom|mommy|mummy|mother|stepdad|stepfather|stepmom|stepmum|stepmother|uncle|aunt|grandpa|grandma|teacher|coach|neighbou?r|babysitter)`;
const EN_HURTS = String.raw`(?:hits|beats|kicks|chokes|hurts|abuses|rapes)`;
const EN_NOT_A_GAME = String.raw`(?!\s+(?:\w+\s+)?(?:at|in)\b)`;

const rx = (source: string) => new RegExp(source);

/**
 * A short, reviewed catalog of first-person phrases (#90). Only strong signals: a false positive
 * shows a calm help text instead of a hint, a false negative leaves a child alone. Third persons in
 * a story ("Die Katze ist tot", "Tom schlägt den Ball") and everyday hyperbole ("Mathe bringt mich
 * um", "Ich lach mich tot") do not match. A phrase quoted inside a task does; that is accepted.
 */
const DISTRESS_PATTERNS: readonly (readonly [DistressCategory, RegExp])[] = [
  // Wanting to die, suicide, self-harm.
  [
    'self_harm',
    rx(String.raw` ich\s+${WANT}\s+${NOT_ANYMORE}\s+(?:leben|lebn|da\s+sein|aufwachen)\b`),
  ],
  ['self_harm', rx(String.raw` ich\s+${WANT}\s+(?:lieber\s+)?(?:sterben|tot\s+sein)\b`)],
  ['self_harm', rx(String.raw` ich\s+(?:waere|waer|war)\s+(?:am\s+liebsten|lieber)\s+tot\b`)],
  ['self_harm', rx(String.raw` am\s+liebsten\s+(?:waere|war)\s+ich\s+tot\b`)],
  ['self_harm', rx(String.raw` ich\s+(?:${WANT}\s+)?(?:mich\s+umbringen|bringe?\s+mich\s+um)\b`)],
  [
    'self_harm',
    rx(String.raw` ich\s+${WANT}\s+mir\s+(?:das\s+leben\s+nehmen|(?:was|etwas)\s+antun)\b`),
  ],
  ['self_harm', rx(String.raw` ich\s+(?:ritze|ritz)\s+mich\b`)],
  [
    'self_harm',
    rx(
      String.raw` ich\s+(?:verletze|verletz|schneide|schneid)\s+mich\s+(?:selbst|absichtlich|extra|immer\s+wieder)\b`,
    ),
  ],
  ['self_harm', rx(String.raw` ich\s+(?:denke|denk)\s+(?:an|ueber)\s+(?:selbstmord|suizid)\b`)],
  ['self_harm', rx(String.raw` (?:keiner|niemand)\s+wuerde\s+mich\s+vermissen\b`)],
  ['self_harm', rx(String.raw` i\s+(?:want|wanna)\s+(?:to\s+)?die\b`)],
  [
    'self_harm',
    rx(
      String.raw` (?:i\s+(?:want\s+to|wanna|will|am\s+going\s+to)|im\s+going\s+to)\s+kill\s+myself\b`,
    ),
  ],
  [
    'self_harm',
    rx(
      String.raw` i\s+(?:dont|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|be\s+here)\s+any\s*more\b`,
    ),
  ],
  ['self_harm', rx(String.raw` i\s+(?:cut|hurt|harm)\s+myself\s+(?:on\s+purpose|again|every)\b`)],
  [
    'self_harm',
    rx(String.raw` i\s+(?:think|keep\s+thinking)\s+about\s+(?:suicide|killing\s+myself)\b`),
  ],
  ['self_harm', rx(String.raw` (?:nobody|no\s+one)\s+would\s+miss\s+me\b`)],

  // Violence or abuse against the child.
  [
    'violence_or_abuse',
    rx(
      String.raw` (?:(?:mein|meine|meinen|der|die|unser|unsere)\s+)?${ADULT}\s+${HURTS}\s+mich\b${NOT_A_GAME}`,
    ),
  ],
  [
    'violence_or_abuse',
    rx(
      String.raw` (?:die\s+anderen|alle|die\s+kinder|die\s+jungs|die\s+maedchen)(?:\s+\w+){0,3}\s+${HURT_PLURAL}\s+mich\b${NOT_A_GAME}`,
    ),
  ],
  [
    'violence_or_abuse',
    rx(
      String.raw` ich\s+werde\s+${NOT_A_GAME_WORDS}(?:geschlagen|verpruegelt|verhauen|getreten|gewuergt|missbraucht|vergewaltigt)\b`,
    ),
  ],
  ['violence_or_abuse', rx(String.raw` (?:er|sie|jemand)\s+(?:missbraucht|vergewaltigt)\s+mich\b`)],
  [
    'violence_or_abuse',
    rx(
      String.raw` (?:fasst|beruehrt|anfasst)\s+mich\s+(?:\w+\s+){0,2}(?:unten|zwischen\s+den\s+beinen|an\s+(?:meiner|meinem|meinen|der|dem)\s+(?:scheide|penis|po|popo|brust|intim\w*)|wo\s+ich\s+das\s+nicht\s+will)\b`,
    ),
  ],
  [
    'violence_or_abuse',
    rx(String.raw` (?:zwingt|zwingen)\s+mich\s+(?:mich\s+)?(?:auszuziehen|nackt)\b`),
  ],
  ['violence_or_abuse', rx(String.raw` my\s+${EN_ADULT}\s+${EN_HURTS}\s+me\b${EN_NOT_A_GAME}`)],
  [
    'violence_or_abuse',
    rx(String.raw` (?:i\s+am|im)\s+(?:being\s+)?(?:beaten|abused|hit)\s+(?:at\s+home|by|every)\b`),
  ],
  [
    'violence_or_abuse',
    rx(
      String.raw` (?:touches|touched)\s+me\s+(?:down\s+there|where\s+i\s+dont\s+want|in\s+my\s+private)\b`,
    ),
  ],

  // Acute danger.
  ['acute_danger', rx(String.raw` ich\s+bin\s+(?:gerade\s+|jetzt\s+)?in\s+gefahr\b`)],
  [
    'acute_danger',
    rx(
      String.raw` (?:jemand|ein\s+mann|eine\s+frau|ein\s+fremder|er|sie)\s+(?:verfolgt|bedroht|erpresst)\s+mich\b`,
    ),
  ],
  [
    'acute_danger',
    rx(
      String.raw` (?:er|sie|jemand|mein\s+${ADULT}|meine\s+${ADULT})\s+will\s+mich\s+(?:umbringen|toeten|abstechen)\b`,
    ),
  ],
  ['acute_danger', rx(String.raw` ich\s+werde\s+(?:bedroht|verfolgt|erpresst)\b`)],
  ['acute_danger', rx(String.raw` (?:i\s+am|im)\s+in\s+danger\b`)],
  [
    'acute_danger',
    rx(
      String.raw` (?:someone|a\s+man|a\s+woman|a\s+stranger|he|she)\s+(?:is\s+following|follows|threatens|is\s+threatening)\s+me\b`,
    ),
  ],
  ['acute_danger', rx(String.raw` (?:he|she|someone)\s+(?:wants|is\s+going)\s+to\s+kill\s+me\b`)],
];

/**
 * The first distress category a child's own message clearly signals, or `null` (#90). Pure and
 * deterministic: no AI, no I/O. Runs on every child input before anything else looks at it.
 */
export function detectDistressSignal(text: string): DistressCategory | null {
  const normalized = normalizeForDistress(text);
  const match = DISTRESS_PATTERNS.find(([, pattern]) => pattern.test(normalized));
  return match ? match[0] : null;
}
