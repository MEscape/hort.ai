import { CliError, formatHelp, parseArgs, parseList } from '../lib/args';
import { LOCALES, PATHS } from '../lib/config';
import { parseFields, resolveUnique } from '../lib/fields';
import { formatSource } from '../lib/format';
import { Plan, REPO_ROOT, formatSummary } from '../lib/fs';
import { buildSpec } from '../lib/spec';
import {
  constraintsTemplate,
  createCommandTemplate,
  dependenciesTemplate,
  deleteCommandTemplate,
  getQueryTemplate,
  limitsTemplate,
  listQueryTemplate,
  loadAuthorizedTemplate,
  scopeTemplate,
  updateCommandTemplate,
  viewMappersTemplate,
  viewsTemplate,
} from '../templates/application';
import {
  auditPortTemplate,
  errorsTemplate,
  idsTemplate,
  modelTemplate,
  repositoryPortTemplate,
} from '../templates/domain';
import {
  auditLoggerTemplate,
  prismaRepositoryTemplate,
  recordMapperTemplate,
} from '../templates/infrastructure';
import {
  createActionTemplate,
  deleteActionTemplate,
  deleteSchemaTemplate,
  dtoTemplate,
  editSchemaTemplate,
  fieldsSchemaTemplate,
  i18nTemplate,
  messageKeysTemplate,
  newSchemaTemplate,
  parseInputTemplate,
  routesTemplate,
  updateActionTemplate,
} from '../templates/presentation';
import {
  clientTemplate,
  compositionTemplate,
  indexTemplate,
  modelTestTemplate,
  permissionSnippet,
  prismaSnippet,
  registerLocale,
} from '../templates/wiring';

import type { FlagSpecs } from '../lib/args';
import type { ModuleSpec } from '../lib/spec';

export const MODULE_FLAGS = {
  entity: { type: 'string', description: 'Entity name (kebab-case). Default: the stem.' },
  stem: {
    type: 'string',
    description:
      'Singular name for module-level files and symbols. Default: singular of the module name.',
  },
  fields: {
    type: 'string',
    description:
      'Comma-separated fields: name:type[?] | name:enum(a|b). Types: string number money boolean date enum.',
  },
  unique: {
    type: 'string',
    description: 'Comma-separated required fields that must be unique per tenant.',
  },
  client: {
    type: 'boolean',
    description: 'Also generate client.ts (browser-safe entry).',
    default: false,
  },
  tests: { type: 'boolean', description: 'Generate the domain test file.', default: true },
  'dry-run': {
    type: 'boolean',
    description: 'Validate and list the files without writing.',
    default: false,
  },
  help: { type: 'boolean', description: 'Show this help.', alias: 'h', default: false },
} as const satisfies FlagSpecs;

const HELP = formatHelp(
  'npm run gen -- module <name> --fields <fields> [options]',
  'Scaffold a business module (tenant-owned entity with create/update/delete, get and list).',
  MODULE_FLAGS,
  [
    'npm run gen -- module inventory --fields "name:string,note:string?,quantity:number" --unique name',
    'npm run gen -- module invoices --stem invoice --fields "amountCents:money,status:enum(draft|sent|paid)"',
  ],
);

/** Builds every file of a new business module, formatted, keyed by repo-relative path. */
export async function buildModuleFiles(
  spec: ModuleSpec,
  root: string,
): Promise<Map<string, string>> {
  const m = `${PATHS.modules}/${spec.dir.kebab}`;
  const { stem, entity, entities } = spec;
  const raw: Array<[string, string]> = [
    [`${m}/domain/errors/${stem.kebab}-errors.ts`, errorsTemplate(spec)],
    [`${m}/domain/models/ids.ts`, idsTemplate(spec)],
    [`${m}/domain/models/${entity.kebab}.ts`, modelTemplate(spec)],
    [`${m}/domain/ports/${entity.kebab}.repository.ts`, repositoryPortTemplate(spec)],
    [`${m}/domain/ports/${stem.kebab}-audit-log.port.ts`, auditPortTemplate(spec)],

    [`${m}/application/${stem.kebab}-dependencies.ts`, dependenciesTemplate(spec)],
    [`${m}/application/${stem.kebab}-limits.ts`, limitsTemplate(spec)],
    [`${m}/application/${stem.kebab}-view-mappers.ts`, viewMappersTemplate(spec)],
    [`${m}/application/${entity.kebab}-scope.ts`, scopeTemplate(spec)],
    [`${m}/application/load-authorized-${entity.kebab}.ts`, loadAuthorizedTemplate(spec)],
    [`${m}/application/contracts/${stem.kebab}-constraints.ts`, constraintsTemplate(spec)],
    [`${m}/application/contracts/${stem.kebab}-views.ts`, viewsTemplate(spec)],
    [`${m}/application/commands/create-${entity.kebab}.ts`, createCommandTemplate(spec)],
    [`${m}/application/commands/update-${entity.kebab}.ts`, updateCommandTemplate(spec)],
    [`${m}/application/commands/delete-${entity.kebab}.ts`, deleteCommandTemplate(spec)],
    [`${m}/application/queries/get-${entity.kebab}-by-id.ts`, getQueryTemplate(spec)],
    [`${m}/application/queries/list-${entities.kebab}.ts`, listQueryTemplate(spec)],

    [`${m}/infrastructure/prisma/${entity.kebab}-record-mapper.ts`, recordMapperTemplate(spec)],
    [
      `${m}/infrastructure/prisma/prisma-${entity.kebab}.repository.ts`,
      prismaRepositoryTemplate(spec),
    ],
    [`${m}/infrastructure/audit/logger-${stem.kebab}-audit-log.ts`, auditLoggerTemplate(spec)],

    [`${m}/presentation/actions/create-${entity.kebab}-action.ts`, createActionTemplate(spec)],
    [`${m}/presentation/actions/update-${entity.kebab}-action.ts`, updateActionTemplate(spec)],
    [`${m}/presentation/actions/delete-${entity.kebab}-action.ts`, deleteActionTemplate(spec)],
    [`${m}/presentation/dto/${entity.kebab}-dto.ts`, dtoTemplate(spec)],
    [`${m}/presentation/messages/message-keys.ts`, messageKeysTemplate(spec)],
    [`${m}/presentation/schemas/${entity.kebab}-fields-schema.ts`, fieldsSchemaTemplate(spec)],
    [`${m}/presentation/schemas/new-${entity.kebab}-schema.ts`, newSchemaTemplate(spec)],
    [`${m}/presentation/schemas/${entity.kebab}-edit-schema.ts`, editSchemaTemplate(spec)],
    [`${m}/presentation/schemas/delete-${entity.kebab}-schema.ts`, deleteSchemaTemplate(spec)],
    [`${m}/presentation/schemas/parse-${stem.kebab}-input.ts`, parseInputTemplate(spec)],
    [`${m}/presentation/routes.ts`, routesTemplate(spec)],
    ...LOCALES.map((locale): [string, string] => [
      `${m}/presentation/i18n/${locale}.json`,
      i18nTemplate(spec, locale),
    ]),

    [`${m}/composition.ts`, compositionTemplate(spec)],
    [`${m}/index.ts`, indexTemplate(spec)],
    ...(spec.withClient ? [[`${m}/client.ts`, clientTemplate(spec)] as [string, string]] : []),
    ...(spec.withTests
      ? [
          [
            `${PATHS.moduleTests}/${spec.dir.kebab}/${entity.kebab}.test.ts`,
            modelTestTemplate(spec),
          ] as [string, string],
        ]
      : []),
  ];

  const files = new Map<string, string>();
  for (const [rel, content] of raw) {
    files.set(rel, await formatSource(root, rel, content));
  }
  return files;
}

export function nextSteps(spec: ModuleSpec): string {
  const { dir } = spec;
  return [
    '',
    'Next steps (manual: they need a product decision or a migration):',
    '',
    '1. Add the model to prisma/schema.prisma:',
    '',
    ...prismaSnippet(spec)
      .split('\n')
      .map((line) => `   ${line}`),
    '',
    `2. Add the permissions to src/modules/auth/domain/models/permission.ts, and grant them`,
    `   in role.ts (ROLE_PERMISSIONS is exhaustive, so decide per role):`,
    `   ${permissionSnippet(spec)}`,
    '',
    '3. Create the migration as described in docs/conventions/adding-a-database-migration.md, then:',
    '   npm run db:generate && npx prisma migration plan && npm run db:migrate && npm run db:verify',
    '',
    `4. Build the UI: pages under src/app/[locale]/..., components under src/modules/${dir.kebab}/presentation/components/,`,
    '   and encode your real business rules in the domain model (generated validation only checks field shape).',
    '',
    '5. Verify:',
    '   npm run typecheck && npm run lint && npm test',
  ].join('\n');
}

export async function runModule(argv: string[], options: { root?: string } = {}): Promise<string> {
  const root = options.root ?? REPO_ROOT;
  const { positionals, flags } = parseArgs(argv, MODULE_FLAGS);
  if (flags['help'] === true) {
    return HELP;
  }

  const [name, ...extra] = positionals;
  if (name === undefined) {
    throw new CliError(`Missing module name.\n\n${HELP}`);
  }
  if (extra.length > 0) {
    throw new CliError(`Unexpected argument "${extra[0]}". Quote --fields if it contains spaces.`);
  }
  if (typeof flags['fields'] !== 'string') {
    throw new CliError(`Missing --fields.\n\n${HELP}`);
  }

  const fields = parseFields(parseList(flags['fields']));
  const unique = resolveUnique(parseList(flags['unique']), fields);
  const spec = buildSpec({
    module: name,
    stem: typeof flags['stem'] === 'string' ? flags['stem'] : undefined,
    entity: typeof flags['entity'] === 'string' ? flags['entity'] : undefined,
    fields,
    unique,
    withClient: flags['client'] === true,
    withTests: flags['tests'] !== false,
  });

  const plan = new Plan(root);
  if (plan.exists(`${PATHS.modules}/${spec.dir.kebab}`)) {
    throw new CliError(
      `Module "${spec.dir.kebab}" already exists (${PATHS.modules}/${spec.dir.kebab}). Use \`gen usecase\` to extend it.`,
    );
  }

  for (const [rel, content] of await buildModuleFiles(spec, root)) {
    plan.create(rel, content);
  }
  for (const locale of LOCALES) {
    plan.edit(`${PATHS.locales}/${locale}.ts`, registerLocale(spec, locale));
  }

  const dryRun = flags['dry-run'] === true;
  const summary = plan.commit({ dryRun });
  return [formatSummary(summary, dryRun), nextSteps(spec)].join('\n');
}
