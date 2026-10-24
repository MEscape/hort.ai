import { CliError, formatHelp, parseArgs } from '../lib/args';
import { LOCALES, PATHS } from '../lib/config';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';
import { assertKebabName, toCamel } from '../lib/names';

import type { FlagSpecs } from '../lib/args';
import type { Locale } from '../lib/config';

type Json = Record<string, unknown>;

const [PRIMARY, ...OTHERS] = LOCALES;

function flagSpecs(): FlagSpecs {
  const specs: Record<string, FlagSpecs[string]> = {
    module: {
      type: 'string',
      description:
        "Add to this module's namespace. Omit for the app shell (src/i18n/messages/<locale>.json).",
      alias: 'm',
    },
  };
  for (const locale of OTHERS) {
    specs[locale] = {
      type: 'string',
      description: `Text for ${locale}. Default: the ${PRIMARY} text with a "[${locale}]" marker.`,
    };
  }
  specs['dry-run'] = {
    type: 'boolean',
    description: 'Validate and list the files without writing.',
    default: false,
  };
  specs['help'] = { type: 'boolean', description: 'Show this help.', alias: 'h', default: false };
  return specs;
}

const FLAGS = flagSpecs();

const HELP = formatHelp(
  'npm run gen -- translation <key> "<text>" [-m <module>]',
  `Add one message to every locale (${LOCALES.join(', ')}) in a single change. The key is relative to the namespace.`,
  FLAGS,
  [
    'npm run gen -- translation home.subtitle "Plan your trip" --de "Plane deine Reise"',
    'npm run gen -- translation errors.locked "This item is locked" -m inventory',
  ],
);

const KEY = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/;

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)/g)].flatMap((match) => match[1] ?? []);
}

function checkText(label: string, text: string): void {
  const opens = (text.match(/\{/g) ?? []).length;
  const closes = (text.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    throw new CliError(`${label} has unbalanced braces; placeholders are written {name}.`);
  }
}

/** Sets `dotted` inside `root`, creating objects on the way. Throws on any collision. */
function setKey(root: Json, dotted: string, value: string, where: string): void {
  const parts = dotted.split('.');
  let node = root;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (next === undefined) {
      const created: Json = {};
      node[part] = created;
      node = created;
    } else if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
      node = next as Json;
    } else {
      throw new CliError(
        `"${part}" in ${where} is a message, not a group; it cannot contain "${dotted}".`,
      );
    }
  }
  const last = parts[parts.length - 1] ?? '';
  if (last in node) {
    throw new CliError(`Key "${dotted}" already exists in ${where}. Nothing was written.`);
  }
  node[last] = value;
}

/** Adds the message to one locale file; `namespace` is the module's root key, if any. */
export function addMessage(
  where: string,
  namespace: string | undefined,
  key: string,
  text: string,
): (source: string) => string {
  return (source) => {
    let root: unknown;
    try {
      root = JSON.parse(source);
    } catch {
      throw new CliError(`${where} is not valid JSON.`);
    }
    if (typeof root !== 'object' || root === null || Array.isArray(root)) {
      throw new CliError(`${where} must contain a JSON object.`);
    }
    let target = root as Json;
    if (namespace !== undefined) {
      const group = target[namespace];
      if (typeof group !== 'object' || group === null || Array.isArray(group)) {
        throw new CliError(`${where} has no "${namespace}" namespace.`);
      }
      target = group as Json;
    }
    setKey(target, key, text, where);
    return `${JSON.stringify(root, null, 2)}\n`;
  };
}

export function runTranslation(argv: string[], options: { root?: string } = {}): string {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }
  const [key, text, ...extra] = positionals;
  if (key === undefined || text === undefined) {
    throw new CliError(`Need a key and the ${PRIMARY} text.\n\n${HELP}`);
  }
  if (extra.length > 0) {
    throw new CliError(`Unexpected argument "${extra[0]}". Quote the text.`);
  }
  if (!KEY.test(key)) {
    throw new CliError(
      `Key "${key}" must be dot-separated camelCase with at least two parts, e.g. errors.notFound.`,
    );
  }
  if (text.trim().length === 0) {
    throw new CliError('The text must not be empty.');
  }

  const moduleDir =
    typeof flags['module'] === 'string'
      ? assertKebabName(flags['module'], 'module name')
      : undefined;
  const namespace = moduleDir === undefined ? undefined : toCamel(moduleDir);

  const textFor = (locale: Locale): string => {
    if (locale === PRIMARY) {
      return text;
    }
    const given = flags[locale];
    return typeof given === 'string' ? given : `[${locale}] ${text}`;
  };

  const plan = new Plan(root);
  for (const locale of LOCALES) {
    const value = textFor(locale);
    checkText(`The ${locale} text`, value);
    if (placeholders(value).sort().join() !== placeholders(text).sort().join()) {
      throw new CliError(
        `The ${locale} text must use the same placeholders as the ${PRIMARY} text.`,
      );
    }
    const file =
      moduleDir === undefined
        ? `${PATHS.appMessages}/${locale}.json`
        : `${PATHS.modules}/${moduleDir}/presentation/i18n/${locale}.json`;
    if (!plan.exists(file)) {
      throw new CliError(
        `${file} not found${moduleDir === undefined ? '' : `: is "${moduleDir}" a module`}.`,
      );
    }
    plan.edit(file, addMessage(file, namespace, key, value));
  }

  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });
  const untranslated = OTHERS.filter((locale) => typeof flags[locale] !== 'string');
  return [
    formatSummary(summary, dryRun),
    '',
    'Next steps:',
    ...(untranslated.length > 0
      ? [
          `1. Replace the "[${untranslated.join('], [')}]" placeholder text: a missing translation is a defect.`,
        ]
      : []),
    '2. Reference the key statically; pass values as placeholders, never by concatenation.',
    '3. Run `npm run i18n:check`.',
  ].join('\n');
}
