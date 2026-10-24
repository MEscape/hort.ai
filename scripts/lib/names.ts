import { CliError } from './args';

/** Splits kebab/snake/camel/Pascal/space-separated input into lowercase words. */
function toWords(input: string): string[] {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_./]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export const toKebab = (input: string): string => toWords(input).join('-');
export const toPascal = (input: string): string => toWords(input).map(capitalize).join('');
export const toCamel = (input: string): string => {
  const pascal = toPascal(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};
export const toSnake = (input: string): string => toWords(input).join('_');
export const toUpperSnake = (input: string): string => toSnake(input).toUpperCase();

/**
 * Naive English singularisation, enough for identifiers
 * (`lesson-plans` -> `lesson-plan`). Wrong guesses are fixed with `--stem`.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('ies') && lower.length > 3) {
    return `${word.slice(0, -3)}y`;
  }
  if (/(ss|us|is)$/.test(lower)) {
    return word;
  }
  if (/(xes|ches|shes|sses|zes)$/.test(lower)) {
    return word.slice(0, -2);
  }
  if (lower.endsWith('s') && lower.length > 1) {
    return word.slice(0, -1);
  }
  return word;
}

/** English plural for variable and function names (`item` -> `items`). */
export function pluralize(word: string): string {
  if (/[^aeiou]y$/.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (/(s|x|z|ch|sh)$/.test(word)) {
    return `${word}es`;
  }
  return `${word}s`;
}

/** A kebab-case word list. Rejects everything else instead of normalising it. */
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const RESERVED = new Set([
  'abstract',
  'arguments',
  'await',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/**
 * Validates a name that becomes a directory or file segment and an
 * identifier. Names are never silently rewritten: `../x` or `a/b` is an
 * error, not `x` or `a-b`.
 */
export function assertKebabName(value: string, label: string): string {
  if (!KEBAB.test(value) || value.length > 40) {
    throw new CliError(
      `Invalid ${label} "${value}". Use lowercase kebab-case (letters, digits, single hyphens; at most 40 characters), e.g. "order-items".`,
    );
  }
  if (value.split('-').some((word) => RESERVED.has(word)) || RESERVED.has(toCamel(value))) {
    throw new CliError(`Invalid ${label} "${value}": it contains a reserved word.`);
  }
  return value;
}

/** Every spelling one concept needs. */
export interface NameSet {
  /** `order-item` */
  readonly kebab: string;
  /** `OrderItem` */
  readonly pascal: string;
  /** `orderItem` */
  readonly camel: string;
  /** `order_item` */
  readonly snake: string;
  /** `ORDER_ITEM` */
  readonly upperSnake: string;
}

export function nameSet(kebab: string): NameSet {
  return {
    kebab,
    pascal: toPascal(kebab),
    camel: toCamel(kebab),
    snake: toSnake(kebab),
    upperSnake: toUpperSnake(kebab),
  };
}
