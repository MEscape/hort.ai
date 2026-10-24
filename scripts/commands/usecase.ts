import { CliError, formatHelp, parseArgs } from '../lib/args';
import { PATHS } from '../lib/config';
import { formatSource } from '../lib/format';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';
import { assertKebabName, nameSet } from '../lib/names';

import type { FlagSpecs } from '../lib/args';
import type { NameSet } from '../lib/names';

export const USECASE_FLAGS = {
  module: { type: 'string', description: 'Module the use case belongs to (required).', alias: 'm' },
  query: { type: 'boolean', description: 'Generate a query instead of a command.', default: false },
  entity: {
    type: 'string',
    description: 'Entity, if the module has several load-authorized-* files.',
  },
  action: {
    type: 'boolean',
    description:
      'Also generate the Server Action and input schema for a command that takes { id } (needs the standard schema, routes and parse helper).',
    default: false,
  },
  wire: {
    type: 'boolean',
    description:
      'Register the use case in composition.ts (aborts, writing nothing, if its shape is unexpected).',
    default: true,
  },
  'dry-run': {
    type: 'boolean',
    description: 'Validate and list the files without writing.',
    default: false,
  },
  help: { type: 'boolean', description: 'Show this help.', alias: 'h', default: false },
} as const satisfies FlagSpecs;

const HELP = formatHelp(
  'npm run gen -- usecase <name> -m <module> [--query]',
  'Add one command (default) or query to an existing business module.',
  USECASE_FLAGS,
  [
    'npm run gen -- usecase archive-item -m inventory',
    'npm run gen -- usecase archive-item -m inventory --action',
    'npm run gen -- usecase list-low-stock -m inventory --query',
  ],
);

interface Existing {
  readonly stem: NameSet;
  readonly entity: NameSet;
  /** Permission resource the module already uses (`item` in `item.read`). */
  readonly permission: string;
  /** Audit event prefix the module already uses (`item` in `item.created`). */
  readonly eventPrefix: string;
}

/** Most frequent first capture group of `pattern` across `sources`, or `fallback`. */
function mostCommon(sources: readonly string[], pattern: RegExp, fallback: string): string {
  const counts = new Map<string, number>();
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) {
      const key = match[1];
      if (key !== undefined) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  const best = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
  return best?.[0] ?? fallback;
}

/**
 * Reads the module's own names from its files instead of guessing them, and
 * refuses modules that do not follow the standard shape the skeletons rely
 * on (the loader, its error type, its result property and, for queries, the
 * view mapper). Nothing is written in that case.
 */
function inspectModule(
  plan: Plan,
  moduleDir: string,
  entityFlag: string | undefined,
  kind: 'commands' | 'queries',
): Existing {
  const application = `${PATHS.modules}/${moduleDir}/application`;
  const files = plan.list(application);
  if (files.length === 0) {
    throw new CliError(
      `Module "${moduleDir}" not found at ${PATHS.modules}/${moduleDir}. Create it with \`gen module\`.`,
    );
  }
  const stems = files.flatMap((file) => /^([a-z0-9-]+)-dependencies\.ts$/.exec(file)?.[1] ?? []);
  const entities = files.flatMap(
    (file) => /^load-authorized-([a-z0-9-]+)\.ts$/.exec(file)?.[1] ?? [],
  );

  if (stems.length === 0 || entities.length === 0) {
    throw new CliError(
      `Module "${moduleDir}" is not a standard business module (it needs <module>-dependencies.ts and load-authorized-<entity>.ts in ${application}); \`usecase\` only extends those.`,
    );
  }
  if (stems.length !== 1) {
    throw new CliError(
      `Expected exactly one *-dependencies.ts in ${application}, found ${stems.length}.`,
    );
  }
  const entityName = entityFlag ?? entities[0];
  if (entityName === undefined || (entityFlag === undefined && entities.length !== 1)) {
    throw new CliError(
      `Cannot tell the entity of "${moduleDir}" (load-authorized files: ${entities.join(', ')}). Pass --entity <name>.`,
    );
  }
  if (!entities.includes(entityName)) {
    throw new CliError(
      `Entity "${entityName}" has no load-authorized-${entityName}.ts in ${application}.`,
    );
  }
  const stem = nameSet(stems[0] ?? '');
  const entity = nameSet(entityName);

  const missing = missingConventions(plan, application, stem, entity, kind);
  if (missing.length > 0) {
    throw new CliError(
      [
        `Module "${moduleDir}" deviates from the standard module shape, so a skeleton would not compile:`,
        ...missing.map((item) => `  - ${item}`),
        'Write this use case by hand (docs/conventions/adding-a-use-case.md).',
      ].join('\n'),
    );
  }

  const useCaseSources = [
    ...plan.list(`${application}/commands`).map((f) => plan.read(`${application}/commands/${f}`)),
    ...plan.list(`${application}/queries`).map((f) => plan.read(`${application}/queries/${f}`)),
  ];
  const auditPort = plan
    .list(`${PATHS.modules}/${moduleDir}/domain/ports`)
    .filter((f) => f.endsWith('-audit-log.port.ts'))
    .map((f) => plan.read(`${PATHS.modules}/${moduleDir}/domain/ports/${f}`));

  return {
    stem,
    entity,
    permission: mostCommon(useCaseSources, /'([a-z]+)\.[a-z]+'/g, entity.kebab.replaceAll('-', '')),
    eventPrefix: mostCommon(auditPort, /type: '([a-z_]+)\./g, entity.snake),
  };
}

function missingConventions(
  plan: Plan,
  application: string,
  stem: NameSet,
  entity: NameSet,
  kind: 'commands' | 'queries',
): string[] {
  const E = entity.pascal;
  const loader = plan.read(`${application}/load-authorized-${entity.kebab}.ts`);
  const missing: string[] = [];
  if (!new RegExp(`export function loadAuthorized${E}\\(`).test(loader)) {
    missing.push(`load-authorized-${entity.kebab}.ts does not export loadAuthorized${E}()`);
  }
  if (!new RegExp(`export type Load${E}Error\\b`).test(loader)) {
    missing.push(`load-authorized-${entity.kebab}.ts does not export type Load${E}Error`);
  }
  const result = new RegExp(
    `export interface Authorized${E}\\s*\\{[^}]*readonly ${entity.camel}:`,
  ).test(loader);
  if (!result) {
    missing.push(
      `Authorized${E} has no \`${entity.camel}\` property (the skeleton destructures it)`,
    );
  }
  if (kind === 'queries') {
    const mappers = `${application}/${stem.kebab}-view-mappers.ts`;
    if (
      !plan.exists(mappers) ||
      !new RegExp(`export function to${E}View\\(`).test(plan.read(mappers))
    ) {
      missing.push(`${stem.kebab}-view-mappers.ts does not export to${E}View()`);
    }
  }
  return missing;
}

function commandTemplate(
  name: NameSet,
  { stem, entity, permission, eventPrefix }: Existing,
  verb: string,
): string {
  const E = entity.pascal;
  return `import type { AppResultAsync } from '@lib/result';

import { loadAuthorized${E} } from '../load-authorized-${entity.kebab}';

import type { Load${E}Error } from '../load-authorized-${entity.kebab}';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

export interface ${name.pascal}Input {
  readonly id: string;
}

/** TODO: describe what "${name.kebab.replaceAll('-', ' ')}" does and which business rules it enforces. */
export class ${name.pascal} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(input: ${name.pascal}Input): AppResultAsync<void, Load${E}Error> {
    const { audit } = this.deps;

    return loadAuthorized${E}(this.deps, input.id, '${permission}.${verb}').map(
      ({ actor, ${entity.camel} }) => {
        audit.record({
          type: '${eventPrefix}.${name.snake}',
          actorId: actor.id,
          tenantId: actor.tenantId,
          ${entity.camel}Id: ${entity.camel}.id,
        });
      },
    );
  }
}
`;
}

function queryTemplate(name: NameSet, { stem, entity, permission }: Existing): string {
  const E = entity.pascal;
  return `import type { AppResultAsync } from '@lib/result';

import { loadAuthorized${E} } from '../load-authorized-${entity.kebab}';
import { to${E}View } from '../${stem.kebab}-view-mappers';

import type { ${E}View } from '../contracts/${stem.kebab}-views';
import type { Load${E}Error } from '../load-authorized-${entity.kebab}';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

/** TODO: describe what "${name.kebab.replaceAll('-', ' ')}" returns. Queries never write and never audit. */
export class ${name.pascal} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(id: string): AppResultAsync<${E}View, Load${E}Error> {
    return loadAuthorized${E}(this.deps, id, '${permission}.read').map(
      ({ ${entity.camel} }) => to${E}View(${entity.camel}),
    );
  }
}
`;
}

/** What an action adapter relies on; each missing piece makes `--action` refuse. */
function missingActionParts(plan: Plan, moduleDir: string, { stem, entity }: Existing): string[] {
  const presentation = `${PATHS.modules}/${moduleDir}/presentation`;
  const checks: Array<[string, RegExp, string]> = [
    [
      `${presentation}/schemas/${entity.kebab}-fields-schema.ts`,
      new RegExp(`export const ${entity.camel}IdSchema\\b`),
      `${entity.camel}IdSchema`,
    ],
    [
      `${presentation}/schemas/parse-${stem.kebab}-input.ts`,
      new RegExp(`export (const|function) parse${stem.pascal}Input\\b`),
      `parse${stem.pascal}Input`,
    ],
    [
      `${presentation}/routes.ts`,
      new RegExp(`export const ${stem.camel}Routes\\b`),
      `${stem.camel}Routes`,
    ],
  ];
  return checks.flatMap(([file, pattern, symbol]) =>
    plan.exists(file) && pattern.test(plan.read(file)) ? [] : [`${file} does not export ${symbol}`],
  );
}

function actionSchemaTemplate(name: NameSet, { entity }: Existing): string {
  return `import { z } from 'zod';

import { ${entity.camel}IdSchema } from './${entity.kebab}-fields-schema';

export const ${name.camel}Schema = z.object({ id: ${entity.camel}IdSchema });
`;
}

function actionTemplate(name: NameSet, { stem }: Existing): string {
  return `'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { ${stem.camel}Commands } from '../../composition';
import { ${stem.camel}Routes } from '../routes';
import { parse${stem.pascal}Input } from '../schemas/parse-${stem.kebab}-input';
import { ${name.camel}Schema } from '../schemas/${name.kebab}-schema';

export async function ${name.camel}Action(input: unknown): Promise<ActionResult<void>> {
  const result = await parse${stem.pascal}Input(${name.camel}Schema, input).asyncAndThen((command) =>
    ${stem.camel}Commands.${name.camel}.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(${stem.camel}Routes.list());
  }
  return toActionResult(result);
}
`;
}

/** Inserts the import and the object property into composition.ts, or throws with the exact snippet. */
export function wireComposition(
  stem: NameSet,
  name: NameSet,
  kind: 'commands' | 'queries',
): (source: string) => string {
  const importLine = `import { ${name.pascal} } from './application/${kind}/${name.kebab}';`;
  const property = `  ${name.camel}: new ${name.pascal}(dependencies),`;
  const objectName = `${stem.camel}${kind === 'commands' ? 'Commands' : 'Queries'}`;
  const manual = `Add manually to composition.ts:\n  ${importLine}\n  in ${objectName}: ${property.trim()}`;

  return (source) => {
    if (source.includes(`./application/${kind}/${name.kebab}'`)) {
      throw new CliError(`composition.ts already imports ${name.kebab}.`);
    }
    const lines = source.split('\n');
    const start = lines.findIndex((line) => line === `export const ${objectName} = {`);
    const end = lines.findIndex((line, index) => index > start && line === '} as const;');
    const importIndexes = lines.flatMap((line, index) =>
      /^import \{ \w+ \} from '\.\/application\/(commands|queries)\/[a-z0-9-]+';$/.test(line)
        ? [index]
        : [],
    );
    if (
      start === -1 ||
      end === -1 ||
      importIndexes.length === 0 ||
      !/^const dependencies = /m.test(source)
    ) {
      throw new CliError(
        `composition.ts does not have the expected shape. ${manual}\n(or run again with --no-wire)`,
      );
    }

    const target = `./application/${kind}/${name.kebab}`;
    const pathOf = (line: string): string => /from '([^']+)'/.exec(line)?.[1] ?? '';
    const before = importIndexes.find((index) => pathOf(lines[index] ?? '') > target);
    // Insert the property first (it is below the imports), so import indexes stay valid.
    lines.splice(end, 0, property);
    lines.splice(before ?? (importIndexes[importIndexes.length - 1] ?? 0) + 1, 0, importLine);
    return lines.join('\n');
  };
}

export async function runUseCase(argv: string[], options: { root?: string } = {}): Promise<string> {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, USECASE_FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }

  const [rawName, ...extra] = positionals;
  if (rawName === undefined) {
    throw new CliError(`Missing use case name.\n\n${HELP}`);
  }
  if (extra.length > 0) {
    throw new CliError(`Unexpected argument "${extra[0]}".`);
  }
  if (typeof flags['module'] !== 'string') {
    throw new CliError(`Missing -m <module>.\n\n${HELP}`);
  }

  const name = nameSet(assertKebabName(rawName, 'use case name'));
  const moduleDir = assertKebabName(flags['module'], 'module name');
  const entityFlag =
    typeof flags['entity'] === 'string'
      ? assertKebabName(flags['entity'], 'entity name')
      : undefined;
  const kind = flags['query'] === true ? 'queries' : 'commands';
  const withAction = flags['action'] === true;
  if (withAction && kind === 'queries') {
    throw new CliError(
      '--action applies to commands only; queries are read from Server Components.',
    );
  }
  if (withAction && flags['wire'] === false) {
    throw new CliError('--action needs the use case registered in composition.ts; drop --no-wire.');
  }

  const plan = new Plan(root);
  const existing = inspectModule(
    plan,
    moduleDir,
    entityFlag,
    kind === 'commands' ? 'commands' : 'queries',
  );
  const verb = name.kebab.split('-')[0] ?? name.kebab;

  const rel = `${PATHS.modules}/${moduleDir}/application/${kind}/${name.kebab}.ts`;
  const source =
    kind === 'commands' ? commandTemplate(name, existing, verb) : queryTemplate(name, existing);
  plan.create(rel, await formatSource(root, rel, source));
  if (withAction) {
    const missing = missingActionParts(plan, moduleDir, existing);
    if (missing.length > 0) {
      throw new CliError(
        [
          `Cannot generate the action for "${moduleDir}": it deviates from the standard presentation shape.`,
          ...missing.map((item) => `  - ${item}`),
          'Write the action by hand (docs/conventions/adding-a-server-action.md) or omit --action.',
        ].join('\n'),
      );
    }
    const presentation = `${PATHS.modules}/${moduleDir}/presentation`;
    const schemaRel = `${presentation}/schemas/${name.kebab}-schema.ts`;
    const actionRel = `${presentation}/actions/${name.kebab}-action.ts`;
    plan.create(
      schemaRel,
      await formatSource(root, schemaRel, actionSchemaTemplate(name, existing)),
    );
    plan.create(actionRel, await formatSource(root, actionRel, actionTemplate(name, existing)));
  }
  if (flags['wire'] !== false) {
    plan.edit(
      `${PATHS.modules}/${moduleDir}/composition.ts`,
      wireComposition(existing.stem, name, kind),
    );
  }

  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });

  const steps =
    kind === 'commands'
      ? [
          '',
          'Next steps (manual):',
          `1. Add the permission '${existing.permission}.${verb}' to src/modules/auth/domain/models/permission.ts and grant it in role.ts.`,
          `2. Add the event to the ${existing.stem.pascal}Event union in domain/ports/${existing.stem.kebab}-audit-log.port.ts:`,
          `   | { readonly type: '${existing.eventPrefix}.${name.snake}'; readonly actorId: ActorId; readonly tenantId: TenantId; readonly ${existing.entity.camel}Id: ${existing.entity.pascal}Id }`,
          `   and its level ('info') in infrastructure/audit/logger-${existing.stem.kebab}-audit-log.ts.`,
          withAction
            ? '3. Implement the business rule in the use case. The generated action takes { id }; extend its schema if the command needs more input.'
            : '3. Implement the business rule in the use case; add a Server Action and schema (or rerun with --action) if the UI calls it.',
        ]
      : [
          '',
          'Next step: replace the skeleton body with the real query (keep it bounded and tenant-scoped).',
        ];
  return [formatSummary(summary, dryRun), ...steps].join('\n');
}
