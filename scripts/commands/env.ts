import { CliError, formatHelp, parseArgs } from '../lib/args';
import { PATHS } from '../lib/config';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';

import type { FlagSpecs } from '../lib/args';

export const ENV_FLAGS = {
  public: {
    type: 'boolean',
    description: 'Expose to the browser (NEXT_PUBLIC_ prefix). Never for secrets.',
    default: false,
  },
  type: { type: 'string', description: 'string | number | boolean | url', default: 'string' },
  optional: { type: 'boolean', description: 'Not required at startup.', default: false },
  default: { type: 'string', description: 'Safe default value (omit for secrets).' },
  description: { type: 'string', description: 'One-line description for .env.example.' },
  example: { type: 'string', description: 'Placeholder value for .env.example.', default: '' },
  'dry-run': {
    type: 'boolean',
    description: 'Validate and list the changes without writing.',
    default: false,
  },
  help: { type: 'boolean', description: 'Show this help.', alias: 'h', default: false },
} as const satisfies FlagSpecs;

const HELP = formatHelp(
  'npm run gen -- env <NAME> [options]',
  'Add an environment variable to .env.example (in the right section) and print the schema line to add.',
  ENV_FLAGS,
  [
    'npm run gen -- env STRIPE_SECRET_KEY --description "Stripe API secret"',
    'npm run gen -- env NEXT_PUBLIC_SUPPORT_URL --public --type url --example https://example.org',
    'npm run gen -- env FEATURE_LIMIT --type number --default 10 --optional',
  ],
);

const TYPES = ['string', 'number', 'boolean', 'url'] as const;
type EnvKind = (typeof TYPES)[number];

const ZOD_BASE: Record<EnvKind, string> = {
  string: 'z.string().min(1)',
  number: 'z.coerce.number()',
  boolean: "z.enum(['true', 'false']).transform((value) => value === 'true')",
  url: 'z.url()',
};

const NAME = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
/** The title line of the numbered "N. Public (...)" section; the rule line above it is its banner. */
const PUBLIC_HEADER = /^# \d+\. Public\b/;

function isEnvKind(value: string): value is EnvKind {
  return TYPES.some((type) => type === value);
}

/**
 * Inserts the entry into the section it belongs to. Server variables go
 * to the end of the last server section (before the Public section's banner); public ones to the
 * end of the file.
 */
export function insertEnvEntry(
  name: string,
  block: string,
  isPublic: boolean,
): (source: string) => string {
  return (source) => {
    if (new RegExp(`^#?\\s*${name}=`, 'm').test(source)) {
      throw new CliError(`${name} is already in ${PATHS.envExample}.`);
    }
    const lines = source.replace(/\n+$/, '').split('\n');
    if (isPublic) {
      return `${[...lines, '', block].join('\n')}\n`;
    }
    const header = lines.findIndex((line) => PUBLIC_HEADER.test(line));
    const banner = header - 1;
    if (header === -1 || !(lines[banner] ?? '').startsWith('# ---')) {
      throw new CliError(
        `Cannot find the PUBLIC section banner in ${PATHS.envExample}. Add manually to the server section:\n${block}`,
      );
    }
    lines.splice(banner, 0, ...block.split('\n'), '');
    return `${lines.join('\n')}\n`;
  };
}

/** The TypeScript literal for a default: numbers and booleans bare, everything else quoted. */
function defaultLiteral(kind: EnvKind, value: string): string {
  return kind === 'number' || kind === 'boolean' ? value : JSON.stringify(value);
}

export function runEnv(argv: string[], options: { root?: string } = {}): string {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, ENV_FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }
  const [name, ...extra] = positionals;
  if (name === undefined) {
    throw new CliError(`Missing variable name.\n\n${HELP}`);
  }
  if (extra.length > 0) {
    throw new CliError(`Unexpected argument "${extra[0]}".`);
  }
  if (!NAME.test(name)) {
    throw new CliError(`Invalid name "${name}". Use UPPER_SNAKE_CASE, e.g. STRIPE_SECRET_KEY.`);
  }

  const isPublic = flags['public'] === true;
  if (isPublic !== name.startsWith('NEXT_PUBLIC_')) {
    throw new CliError(
      isPublic
        ? `Public variables must start with NEXT_PUBLIC_ (got ${name}).`
        : `${name} uses NEXT_PUBLIC_ but --public was not set. Secrets never use this prefix.`,
    );
  }
  if (isPublic && /(SECRET|PASSWORD|PRIVATE)/.test(name)) {
    throw new CliError(
      `${name} looks like a secret but is public: public values are shipped to the browser.`,
    );
  }

  const typeFlag = String(flags['type']);
  if (!isEnvKind(typeFlag)) {
    throw new CliError(`--type must be one of ${TYPES.join(', ')}.`);
  }
  const optional = flags['optional'] === true;
  const fallback = typeof flags['default'] === 'string' ? flags['default'] : undefined;
  if (fallback !== undefined) {
    if (typeFlag === 'number' && !Number.isFinite(Number(fallback))) {
      throw new CliError(`--default "${fallback}" is not a number.`);
    }
    if (typeFlag === 'boolean' && fallback !== 'true' && fallback !== 'false') {
      throw new CliError('--default for a boolean must be true or false.');
    }
  }

  const description = typeof flags['description'] === 'string' ? flags['description'] : name;
  const example = typeof flags['example'] === 'string' ? flags['example'] : '';
  const entry = `# ${description}\n${optional ? '# ' : ''}${name}=${example}`;

  const plan = new Plan(root);
  plan.edit(PATHS.envExample, insertEnvEntry(name, entry, isPublic));
  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });

  const constant =
    fallback === undefined ? undefined : `DEFAULT_${name.replace(/^NEXT_PUBLIC_/, '')}`;
  const literal = fallback === undefined ? '' : defaultLiteral(typeFlag, fallback);
  const base = ZOD_BASE[typeFlag];
  const withDefault = constant === undefined ? base : `${base}.default(${constant})`;
  const schemaLine = `  ${name}: ${optional ? `${withDefault}.optional()` : withDefault},`;
  const schemaName = isPublic ? 'publicEnvSchema' : 'serverEnvBaseSchema';
  const schemaFile = isPublic
    ? 'src/lib/config/public-env-schema.ts'
    : 'src/lib/config/env-schema.ts';

  return [
    formatSummary(summary, dryRun),
    '',
    'Next steps:',
    `1. Add to ${schemaName} in ${schemaFile} (or the schema file of its area, e.g. mail-env-schema.ts):`,
    ...(constant === undefined
      ? []
      : [`   const ${constant} = ${literal};   (next to the other DEFAULT_ constants)`]),
    `   ${schemaLine.trim()}`,
    '2. Read it only through the typed config module; never use process.env elsewhere.',
    '3. Set it in every deployment environment before merging (also .env.docker.example if the container needs it).',
    ...(isPublic && /(TOKEN|KEY)/.test(name)
      ? [
          '4. This name looks like a credential: make sure the value is designed to ship to the browser (e.g. a restricted public token).',
        ]
      : []),
  ].join('\n');
}
