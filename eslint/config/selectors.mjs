/**
 * Selector fragments for `no-restricted-syntax`.
 *
 * ESLint keeps only the LAST matching block's value for a rule key, so each
 * file group below receives ONE array assembled from these constants. Never
 * add a second `no-restricted-syntax` block for an overlapping glob.
 */
import { utilsConstantNames, utilsHelperNames } from './lib-exports.mjs';

export const PROCESS_ENV = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    'Do not access process.env directly; import serverEnv or publicEnv from @lib/config (AI_RULES.md §11).',
};

/** docs/rules/security.md: untrusted content is never rendered as raw HTML. Opt out with a described eslint-disable once it is sanitized. */
export const RAW_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message:
    'Do not render raw HTML (dangerouslySetInnerHTML). Render the content as text or structured components; if sanitized HTML is unavoidable, disable this rule on that line and say how it is sanitized (docs/rules/security.md).',
};

/** Selectors every source file gets, `src/lib/utils` included. */
export const BASE = [PROCESS_ENV, RAW_HTML];

/**
 * docs/rules/shared.md: what the shared library already does is imported, not written again. Two kinds:
 * a local function with the name of a `@lib/utils` helper (the list is read from the library, so it never
 * lags behind), and the hand-written form of a helper that is easy to recognise by its shape.
 */
const UTILS_NAMES = `(${utilsHelperNames().join('|')})`;
const UTILS_CONSTANTS = `(${utilsConstantNames().join('|')})`;
const REUSE =
  '@lib/utils already has this; import it instead of writing it again (src/lib/README.md lists the helpers).';
const FUNCTION_VALUE = '[init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]';
const ARROW_OF_ONE =
  "CallExpression[callee.property.name='filter'] > ArrowFunctionExpression[params.length=1][params.0.type='Identifier']";
const MATH_CALL = (name) =>
  `CallExpression[callee.object.name='Math'][callee.property.name='${name}']`;
export const LIB_DUPLICATES = [
  { selector: `FunctionDeclaration[id.name=/^${UTILS_NAMES}$/]`, message: REUSE },
  { selector: `VariableDeclarator[id.name=/^${UTILS_NAMES}$/]${FUNCTION_VALUE}`, message: REUSE },
  { selector: `VariableDeclarator[id.name=/^${UTILS_CONSTANTS}$/]`, message: REUSE },
  {
    selector: 'Literal[value=60000], Literal[value=3600000], Literal[value=86400000]',
    message:
      'A minute, an hour or a day in milliseconds is MS_PER_MINUTE, MS_PER_DAY... from @lib/utils; use the name so the unit reads.',
  },
  {
    selector:
      "CallExpression[callee.property.name='filter'] > ArrowFunctionExpression[params.length=2][params.0.name=/^_/] > BinaryExpression[operator='!=='][left.type='Identifier'][right.type='Identifier']",
    message: 'Use removeAt(items, index) from @lib/utils to drop the item at an index.',
  },
  {
    selector:
      "CallExpression[callee.property.name='map'] > ArrowFunctionExpression[params.length=2] > ConditionalExpression[test.operator='==='][test.left.type='Identifier'][test.right.type='Identifier'][alternate.type='Identifier'][consequent.type=/^(ObjectExpression|ArrayExpression|Identifier)$/]",
    message: 'Use replaceAt(items, index, value) from @lib/utils to change the item at an index.',
  },
  {
    selector:
      "CallExpression[callee.object.name='Object'][callee.property.name='fromEntries'] > CallExpression[callee.property.name='filter'] > MemberExpression > CallExpression[callee.object.name='Object'][callee.property.name='entries']",
    message:
      'Use pick(), omit() or definedKeys() from @lib/utils to keep or drop keys of an object.',
  },
  {
    selector: "NewExpression[callee.name='URLSearchParams'][arguments.0.type='ObjectExpression']",
    message:
      'Use buildQueryString(params) from @lib/utils; it skips empty values and repeats arrays.',
  },
  {
    selector: `${ARROW_OF_ONE} > BinaryExpression[operator='!=='][left.type='Identifier'][right.raw='null']`,
    message: 'Use .filter(isDefined) from @lib/utils; it also narrows the type.',
  },
  {
    selector: `${ARROW_OF_ONE} > BinaryExpression[operator='!=='][left.type='Identifier'][right.type='Identifier'][right.name='undefined']`,
    message: 'Use .filter(isDefined) from @lib/utils; it also narrows the type.',
  },
  {
    selector: "ArrayExpression > SpreadElement > NewExpression[callee.name='Set']",
    message: 'Use unique() from @lib/utils to drop duplicates; it keeps the order and takes a key.',
  },
  {
    selector:
      "CallExpression[callee.object.name='Array'][callee.property.name='from'] > NewExpression[callee.name='Set']",
    message: 'Use unique() from @lib/utils to drop duplicates; it keeps the order and takes a key.',
  },
  {
    selector: `${MATH_CALL('min')} > ${MATH_CALL('max')}, ${MATH_CALL('max')} > ${MATH_CALL('min')}`,
    message: 'Use clamp() from @lib/utils to keep a number between two bounds.',
  },
  {
    selector:
      "BinaryExpression[operator=/^===?$/][left.type='CallExpression'][left.callee.property.name='trim'][right.value='']",
    message:
      'Use isBlank() from @lib/utils to test for empty or whitespace-only text (trimToNull() when empty should become null).',
  },
  {
    selector:
      "BinaryExpression[operator='*'][left.operator='-'][left.right.value=1][right.name=/[pP]ageSize/]",
    message: 'Use offsetOf() from @lib/pagination for the number of rows a page skips.',
  },
  {
    selector:
      "BinaryExpression[operator='*'][left.operator='-'][left.right.value=1][right.property.name=/[pP]ageSize/]",
    message: 'Use offsetOf() from @lib/pagination for the number of rows a page skips.',
  },
  {
    selector: `${MATH_CALL('ceil')} > BinaryExpression[operator='/'][right.name=/[pP]ageSize/]`,
    message: 'Use pageCountOf() from @lib/pagination for the number of pages.',
  },
];

/** Selectors every source file gets: a block that sets `no-restricted-syntax` spreads these first. */
export const EVERYWHERE = [...BASE, ...LIB_DUPLICATES];

/** docs/rules/typescript.md: domain and application code do not read the clock or randomness; they receive them. */
export const CLOCK_READS = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      'Do not read the clock (Date.now()) in domain/application code; inject a Clock port (AI_RULES.md §1).',
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      'Do not read the clock (new Date()) in domain/application code; inject a Clock port (AI_RULES.md §1).',
  },
  {
    selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
    message:
      'Do not read the clock (performance.now()) in domain/application code; inject a Clock port.',
  },
];

export const RANDOMNESS = [
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      'Do not read randomness (Math.random()) in domain/application code; inject a Random/IdGenerator port (AI_RULES.md §1).',
  },
  {
    selector:
      "CallExpression[callee.object.name='crypto'][callee.property.name=/^(randomUUID|getRandomValues)$/]",
    message:
      'Do not read randomness (crypto.*) in domain/application code; inject an IdGenerator/Random port.',
  },
];

/** Focused tests silently skip the rest of the suite; they must never be committed. */
export const FOCUSED_TESTS = [
  {
    selector:
      "CallExpression[callee.property.name='only'][callee.object.name=/^(it|test|describe|suite)$/]",
    message: 'Remove `.only`: a committed focused test silently skips the rest of the suite.',
  },
  {
    selector: 'CallExpression[callee.name=/^(fit|fdescribe|ftest)$/]',
    message: 'Remove the focused test helper: it silently skips the rest of the suite.',
  },
];

export const FORM_DATA = {
  selector: "TSTypeReference[typeName.name='FormData']",
  message: 'Do not pass raw FormData beyond the presentation boundary (AI_RULES.md §6).',
};

/** docs/rules/nextjs.md: an error boundary never shows the raw failure to visitors. */
export const ERROR_DETAILS = {
  selector: "MemberExpression[object.name='error'][property.name=/^(message|stack|cause)$/]",
  message:
    'An error boundary shows translated generic text; never render the error message, stack or cause (docs/rules/nextjs.md).',
};

/**
 * docs/rules/i18n.md: presentation code formats through `getAppFormatters` / `useAppFormatters`, which bind the
 * request locale and time zone. A hand-built `Intl` formatter or `toLocale*String` call picks its own locale.
 */
export const LOCALE_FORMATTING = [
  {
    selector:
      "NewExpression[callee.object.name='Intl'][callee.property.name=/^(DateTimeFormat|NumberFormat|RelativeTimeFormat|ListFormat|PluralRules)$/]",
    message:
      "Format through getAppFormatters ('@i18n/server') or useAppFormatters ('@i18n/client') instead of building an Intl formatter (docs/rules/i18n.md).",
  },
  {
    selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/]',
    message:
      "Format through getAppFormatters ('@i18n/server') or useAppFormatters ('@i18n/client') instead of toLocale*String (docs/rules/i18n.md).",
  },
];
