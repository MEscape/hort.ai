import { CliError } from '../lib/args';
import { enumTypeName, prismaEnumName, prismaType } from '../lib/fields';
import { hasUnique } from '../lib/spec';

import type { Field } from '../lib/fields';
import type { ModuleSpec } from '../lib/spec';

/** `composition.ts` */
export function compositionTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  return `import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';

import { Create${P} } from './application/commands/create-${entity.kebab}';
import { Delete${P} } from './application/commands/delete-${entity.kebab}';
import { Update${P} } from './application/commands/update-${entity.kebab}';
import { Get${P}ById } from './application/queries/get-${entity.kebab}-by-id';
import { List${entities.pascal} } from './application/queries/list-${entities.kebab}';
import { logger${stem.pascal}AuditLog } from './infrastructure/audit/logger-${stem.kebab}-audit-log';
import { Prisma${P}Repository } from './infrastructure/prisma/prisma-${entity.kebab}.repository';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. \`server-only\` makes an accidental import
 * from a Client Component a build error.
 */
const ${entities.camel} = new Prisma${P}Repository(systemClock);
const authorization = getAccessControl();
const dependencies = { authorization, ${entities.camel}, audit: logger${stem.pascal}AuditLog };

export const ${stem.camel}Commands = {
  create${P}: new Create${P}(dependencies),
  update${P}: new Update${P}(dependencies),
  delete${P}: new Delete${P}(dependencies),
} as const;

export const ${stem.camel}Queries = {
  get${P}ById: new Get${P}ById(dependencies),
  list${entities.pascal}: new List${entities.pascal}(dependencies),
} as const;
`;
}

/** `index.ts` */
export function indexTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  return `/**
 * Server-side public API of the ${spec.dir.kebab} module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from \`./client\` instead: this file reaches server-only
 * code through \`composition.ts\` and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { ${stem.camel}Queries } from './composition';

export { ${stem.camel}Routes } from './presentation/routes';

export { default as en${stem.pascal} } from './presentation/i18n/en.json';
export { default as de${stem.pascal} } from './presentation/i18n/de.json';

export type { ${entity.pascal}View } from './application/contracts/${stem.kebab}-views';
`;
}

/** `client.ts` (only with `--client`) */
export function clientTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const P = entity.pascal;
  return `/**
 * Browser-safe public API: Server Actions and types only, nothing that
 * reaches server-only code. Client Components import from here instead
 * of the main \`index.ts\`, which reaches server-only infrastructure via
 * \`composition.ts\`.
 */

export { create${P}Action } from './presentation/actions/create-${entity.kebab}-action';
export { delete${P}Action } from './presentation/actions/delete-${entity.kebab}-action';
export { update${P}Action } from './presentation/actions/update-${entity.kebab}-action';
export { ${stem.camel}Routes } from './presentation/routes';

export type { ${P}Dto } from './presentation/dto/${entity.kebab}-dto';
`;
}

/** Prisma model + enums, printed for the developer to add to `prisma/schema.prisma`. */
export function prismaSnippet(spec: ModuleSpec): string {
  const { entity, fields, unique } = spec;
  const P = entity.pascal;
  const enumBlocks = fields
    .filter((f): f is Field => f.kind === 'enum')
    .map(
      (f) =>
        `enum ${prismaEnumName(P, f)} {\n${f.enumValues.map((v) => `  ${v.toUpperCase()}`).join('\n')}\n}`,
    );
  const columns = fields.map((f) => `  ${f.name.padEnd(12)} ${prismaType(f, P)}`);
  const uniques =
    unique.length > 0 ? `\n  @@unique([tenantId, ${unique.map((f) => f.name).join(', ')}])` : '';

  return [
    ...enumBlocks,
    `model ${P} {
  id        String   @id @default(uuid())
  tenantId  String
${columns.join('\n')}
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now())

  // The owning tenant (model name = your tenant table): the key keeps the rows inside it and removes them with it.
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([id, tenantId])${uniques}
  // Add a @@check per domain limit (name it <Table>_<what>_rule) and a set_updated_at trigger.
}`,
  ].join('\n\n');
}

/** What the developer must add to the auth module by hand: permissions and their role grants. */
export function permissionSnippet(spec: ModuleSpec): string {
  const verbs = ['create', 'read', 'update', 'delete'];
  return verbs.map((verb) => `'${spec.permission}.${verb}'`).join(', ');
}

// --- Locale registration -----------------------------------------------------

/**
 * Registers the module's namespace in `src/i18n/locales/<locale>.ts`:
 * one import and one entry in `messages`, each inserted in sorted position.
 * Throws (aborting the whole plan) if the file does not have the expected shape.
 */
export function registerLocale(spec: ModuleSpec, locale: 'en' | 'de'): (source: string) => string {
  const exportName = `${locale}${spec.stem.pascal}`;
  const alias = spec.stem.camel;
  const importLine = `import { ${exportName} as ${alias} } from '@modules/${spec.dir.kebab}';`;
  const entry = `  ${spec.dir.camel}: ${alias}.${spec.dir.camel},`;

  return (source) => {
    if (
      source.includes(`'@modules/${spec.dir.kebab}'`) ||
      source.includes(`  ${spec.dir.camel}:`)
    ) {
      throw new CliError(`src/i18n/locales/${locale}.ts already registers "${spec.dir.kebab}".`);
    }
    const lines = source.split('\n');

    const importIndexes = lines.flatMap((line, index) =>
      /^import \{ \w+ as \w+ \} from '@modules\/[a-z0-9-]+';$/.test(line) ? [index] : [],
    );
    const entriesStart = lines.findIndex((line) => line === 'const messages = {');
    const entriesEnd = lines.findIndex(
      (line, index) => index > entriesStart && line.startsWith('} as const'),
    );
    if (entriesStart === -1 || entriesEnd === -1) {
      throw new CliError(
        `Cannot register the namespace: src/i18n/locales/${locale}.ts has an unexpected shape. Add manually:\n  ${importLine}\n${entry}`,
      );
    }

    const modulePath = (line: string): string =>
      /from '@modules\/([a-z0-9-]+)'/.exec(line)?.[1] ?? '';
    const importAt = importIndexes.find((index) => modulePath(lines[index] ?? '') > spec.dir.kebab);
    const lastImport = importIndexes[importIndexes.length - 1];
    const insertImport = importAt ?? (lastImport === undefined ? 0 : lastImport + 1);
    lines.splice(insertImport, 0, importLine);
    if (lastImport === undefined) {
      // The first module: its import opens the file, and a blank line separates it from the rest.
      lines.splice(insertImport + 1, 0, '');
    }

    const start =
      entriesStart +
      1 +
      (insertImport <= entriesStart ? 1 : 0) +
      (lastImport === undefined ? 1 : 0);
    const end = entriesEnd + 1;
    const keyOf = (line: string): string => /^ {2}(\w+)/.exec(line)?.[1] ?? '';
    let at = end;
    for (let index = start; index < end; index += 1) {
      const key = keyOf(lines[index] ?? '');
      if (key !== 'app' && key > spec.dir.camel) {
        at = index;
        break;
      }
    }
    lines.splice(at, 0, entry);
    return lines.join('\n');
  };
}

// --- Tests -------------------------------------------------------------------

function sample(f: Field): string {
  switch (f.kind) {
    case 'string':
      return `'Example ${f.name}'`;
    case 'number':
      return '1.5';
    case 'money':
      return '1000';
    case 'boolean':
      return 'true';
    case 'date':
      return `new Date('2026-01-01T00:00:00.000Z')`;
    case 'enum':
      return `'${f.enumValues[0]}'`;
  }
}

/** `__tests__/src/modules/<dir>/<entity>.test.ts` */
export function modelTestTemplate(spec: ModuleSpec): string {
  const { entity, fields } = spec;
  const P = entity.pascal;
  const input = `{ ${fields.map((f) => `${f.name}: ${sample(f)}`).join(', ')} }`;
  const requiredString = fields.find((f) => f.kind === 'string' && !f.optional);
  const anEnum = fields.find((f) => f.kind === 'enum');
  const someMoney = fields.find((f) => f.kind === 'money' && !f.optional);

  const cases = [
    `  it('accepts a complete input', () => {
    expect(create${P}Draft(valid).isOk()).toBe(true);
  });`,
    requiredString
      ? `  it('reports a blank required text field', () => {
    const result = create${P}Draft({ ...valid, ${requiredString.name}: '   ' });

    expect(result.isErr() && result.error.fieldErrors['${requiredString.name}']).toHaveLength(1);
  });`
      : '',
    someMoney
      ? `  it('rejects a fractional or negative amount', () => {
    expect(create${P}Draft({ ...valid, ${someMoney.name}: 1.5 }).isErr()).toBe(true);
    expect(create${P}Draft({ ...valid, ${someMoney.name}: -1 }).isErr()).toBe(true);
  });`
      : '',
    anEnum
      ? `  it('rejects an unknown option', () => {
    expect(create${P}Draft({ ...valid, ${anEnum.name}: 'nope' }).isErr()).toBe(true);
  });`
      : '',
  ].filter(Boolean);

  return `import { describe, expect, it } from 'vitest';

import {
  create${P}Draft,
  isEmptyChanges,
  parse${P}Changes,
} from '@modules/${spec.dir.kebab}/domain/models/${entity.kebab}';

const valid = ${input};

describe('create${P}Draft', () => {
${cases.join('\n\n')}
});

describe('parse${P}Changes', () => {
  it('treats an empty update as no change', () => {
    const result = parse${P}Changes({});

    expect(result.isOk() && isEmptyChanges(result.value)).toBe(true);
  });

  it('keeps only the provided fields', () => {
    const result = parse${P}Changes({ ${fields[0]?.name ?? 'id'}: ${fields[0] ? sample(fields[0]) : "''"} });

    expect(result.isOk() && Object.keys(result.value)).toEqual(['${fields[0]?.name ?? ''}']);
  });
});
`;
}

export { hasUnique, enumTypeName };
