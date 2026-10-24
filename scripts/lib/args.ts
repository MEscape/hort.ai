/**
 * Minimal, dependency-free CLI parser.
 *
 * Supports:  positional args, `--flag`, `--no-flag`, `--key value`,
 * `--key=value`, and comma lists (`--fields a:string,b:number`).
 */

export interface FlagSpec {
  /** `boolean` flags take no value. `string` flags require one. */
  type: 'boolean' | 'string';
  description: string;
  default?: boolean | string;
  /** Short alias, e.g. `-m` for `--module`. */
  alias?: string;
}

export type FlagSpecs = Record<string, FlagSpec>;

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, boolean | string | undefined>;
}

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export function parseArgs(argv: string[], specs: FlagSpecs): ParsedArgs {
  const aliasToName = new Map<string, string>();
  for (const [name, spec] of Object.entries(specs)) {
    if (spec.alias) {
      aliasToName.set(spec.alias, name);
    }
  }

  const flags: ParsedArgs['flags'] = {};
  for (const [name, spec] of Object.entries(specs)) {
    if (spec.default !== undefined) {
      flags[name] = spec.default;
    }
  }

  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) {
      continue;
    }

    if (!token.startsWith('-') || token === '-') {
      positionals.push(token);
      continue;
    }

    const isLong = token.startsWith('--');
    const raw = token.slice(isLong ? 2 : 1);
    const [rawName, inlineValue] = raw.split(/=(.*)/s);
    if (!rawName) {
      throw new CliError(`Malformed flag: ${token}`);
    }

    const negated = isLong && rawName.startsWith('no-');
    const lookup = negated ? rawName.slice(3) : rawName;
    const name = isLong ? lookup : (aliasToName.get(lookup) ?? lookup);
    const spec = specs[name];

    if (!spec) {
      throw new CliError(
        `Unknown flag: ${token}\nValid flags: ${Object.keys(specs)
          .map((key) => `--${key}`)
          .join(', ')}`,
      );
    }

    if (spec.type === 'boolean') {
      flags[name] = negated ? false : inlineValue !== 'false';
      continue;
    }

    const value = inlineValue ?? argv[(index += 1)];
    if (value === undefined || value.startsWith('--')) {
      throw new CliError(`Flag --${name} requires a value.`);
    }
    flags[name] = value;
  }

  return { positionals, flags };
}

export function formatHelp(
  usage: string,
  summary: string,
  specs: FlagSpecs,
  examples: string[],
): string {
  const width = Math.max(...Object.keys(specs).map((key) => key.length), 8);
  const lines = Object.entries(specs).map(([name, spec]) => {
    const alias = spec.alias ? `-${spec.alias}, ` : '    ';
    const value = spec.type === 'string' ? ' <value>' : '';
    const fallback = spec.default !== undefined ? ` (default: ${String(spec.default)})` : '';
    return `  ${alias}--${name}${value}`.padEnd(width + 18) + spec.description + fallback;
  });

  return [
    summary,
    '',
    `Usage: ${usage}`,
    '',
    'Options:',
    ...lines,
    '',
    'Examples:',
    ...examples.map((example) => `  ${example}`),
  ].join('\n');
}

/** Reads a comma separated flag into a trimmed list. */
export function parseList(value: boolean | string | undefined): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
