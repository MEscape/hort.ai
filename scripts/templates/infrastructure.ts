import { enumTypeName } from '../lib/fields';
import { toUpperSnake } from '../lib/names';
import { hasUnique } from '../lib/spec';

import type { Field } from '../lib/fields';
import type { ModuleSpec } from '../lib/spec';

const hasDates = (spec: ModuleSpec): boolean => spec.fields.some((f) => f.kind === 'date');
const enums = (spec: ModuleSpec): Field[] => spec.fields.filter((f) => f.kind === 'enum');

const enumBase = (spec: ModuleSpec, f: Field): string =>
  `${spec.entity.upperSnake}_${toUpperSnake(f.name)}`;
const recordConst = (spec: ModuleSpec, f: Field): string => `${enumBase(spec, f)}_RECORD`;
const byRecordConst = (spec: ModuleSpec, f: Field): string => `${enumBase(spec, f)}_BY_RECORD`;

function recordType(spec: ModuleSpec, f: Field): string {
  return `${enumTypeName(spec.entity.pascal, f)}Record`;
}

/** TypeScript type of the column as Prisma 8 returns it. */
function readType(spec: ModuleSpec, f: Field): string {
  const base = (() => {
    switch (f.kind) {
      case 'string':
        return 'string';
      case 'number':
      case 'money':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'InstantRecord';
      case 'enum':
        return recordType(spec, f);
    }
  })();
  return f.optional ? `${base} | null` : base;
}

/** TypeScript type of the column as Prisma 8 expects it when writing. */
function writeType(spec: ModuleSpec, f: Field): string {
  const base = f.kind === 'date' ? 'string' : readType(spec, f).replace(' | null', '');
  return f.optional ? `${base} | null` : base;
}

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const CHUNK = 10;

function readExpression(spec: ModuleSpec, f: Field): string {
  const value = `record.${f.name}`;
  if (f.kind === 'date') {
    return f.optional ? `readOptionalInstant(${value})` : `instantToDate(${value})`;
  }
  if (f.kind === 'enum') {
    return f.optional ? `read${cap(f.name)}(${value})` : `${byRecordConst(spec, f)}[${value}]`;
  }
  return value;
}

function writeExpression(spec: ModuleSpec, f: Field, source: string): string {
  const value = `${source}.${f.name}`;
  if (f.kind === 'date') {
    return f.optional ? `writeOptionalInstant(${value})` : `dateToInstant(${value})`;
  }
  if (f.kind === 'enum') {
    return f.optional ? `write${cap(f.name)}(${value})` : `${recordConst(spec, f)}[${value}]`;
  }
  return value;
}

/** Tiny converters, so no generated function grows a branch per field. */
function converterHelpers(spec: ModuleSpec): string {
  const P = spec.entity.pascal;
  const blocks: string[] = [];
  if (spec.fields.some((f) => f.kind === 'date' && f.optional)) {
    blocks.push(`function readOptionalInstant(value: InstantRecord | null): Date | null {
  return value === null ? null : instantToDate(value);
}

function writeOptionalInstant(value: Date | null): string | null {
  return value === null ? null : dateToInstant(value);
}
`);
  }
  for (const f of enums(spec)) {
    if (!f.optional) {
      continue;
    }
    const type = enumTypeName(P, f);
    const record = recordType(spec, f);
    blocks.push(`function read${cap(f.name)}(value: ${record} | null): ${type} | null {
  return value === null ? null : ${byRecordConst(spec, f)}[value];
}

function write${cap(f.name)}(value: ${type} | null): ${record} | null {
  return value === null ? null : ${recordConst(spec, f)}[value];
}
`);
  }
  return blocks.join('\n');
}

/** Update data is built in blocks of ${CHUNK} fields, one \`if\` per field. */
function updateBlocks(spec: ModuleSpec): { functions: string; calls: string } {
  const P = spec.entity.pascal;
  const chunks: Field[][] = [];
  for (let index = 0; index < spec.fields.length; index += CHUNK) {
    chunks.push(spec.fields.slice(index, index + CHUNK));
  }
  const functions = chunks
    .map((chunk, index) => {
      const type = `${P}FieldUpdate${index + 1}`;
      return `type ${type} = Pick<${P}UpdateData, ${chunk.map((f) => `'${f.name}'`).join(' | ')}>;

function toFieldUpdate${index + 1}(changes: ${P}Changes): ${type} {
  const data: ${type} = {};
${chunk
  .map(
    (f) => `  if (changes.${f.name} !== undefined) {
    data.${f.name} = ${writeExpression(spec, f, 'changes')};
  }`,
  )
  .join('\n')}
  return data;
}
`;
    })
    .join('\n');
  const calls = chunks.map((_, index) => `    ...toFieldUpdate${index + 1}(changes),`).join('\n');
  return { functions, calls };
}

/** `infrastructure/prisma/<entity>-record-mapper.ts` */
export function recordMapperTemplate(spec: ModuleSpec): string {
  const { entity, fields } = spec;
  const P = entity.pascal;
  const enumTypes = enums(spec).map((f) => enumTypeName(P, f));
  const modelTypes = [...enumTypes, P, `${P}Changes`, `${P}Draft`].sort();

  const update = updateBlocks(spec);
  const converters = converterHelpers(spec);
  const enumBlocks = enums(spec)
    .map((f) => {
      const typeName = enumTypeName(P, f);
      const recordName = recordConst(spec, f);
      const byRecord = byRecordConst(spec, f);
      return `/** Domain value -> stored enum member, and back. Both tables are exhaustive. */
export const ${recordName} = {
${f.enumValues.map((v) => `  ${v}: '${v.toUpperCase()}',`).join('\n')}
} as const satisfies Record<${typeName}, string>;

export type ${recordType(spec, f)} = (typeof ${recordName})[${typeName}];

const ${byRecord} = {
${f.enumValues.map((v) => `  ${v.toUpperCase()}: '${v}',`).join('\n')}
} as const satisfies Record<${recordType(spec, f)}, ${typeName}>;
`;
    })
    .join('\n');

  return `import { toTenantId } from '@modules/auth';

import { dateToInstant, instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { to${P}Id } from '../../domain/models/ids';

import type { ${modelTypes.join(', ')} } from '../../domain/models/${entity.kebab}';

/**
 * Persistence shapes.
 *
 * Generated Prisma contract types never leave the persistence layer.
 */

export interface ${P}Record {
  readonly id: string;
  readonly tenantId: string;
${fields.map((f) => `  readonly ${f.name}: ${readType(spec, f)};`).join('\n')}
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

/**
 * Field list for \`.select(...)\`.
 *
 * Prisma 8 has no \`select: { ... }\` option. Queries are built by chaining,
 * and \`.select()\` takes field names as separate arguments, so this is
 * spread at the call site: \`.select(...${entity.upperSnake}_SELECT)\`.
 * \`satisfies\` keeps the list in sync with the record shape.
 */
export const ${entity.upperSnake}_SELECT = [
  'id',
  'tenantId',
${fields.map((f) => `  '${f.name}',`).join('\n')}
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof ${P}Record>;

${enumBlocks}
${converters}
export function to${P}(record: ${P}Record): ${P} {
  return {
    id: to${P}Id(record.id),
    tenantId: toTenantId(record.tenantId),
${fields.map((f) => `    ${f.name}: ${readExpression(spec, f)},`).join('\n')}
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

/** The columns written when a ${entity.kebab.replaceAll('-', ' ')} is created. */
export interface ${P}CreateData {
${fields.map((f) => `  ${f.name}: ${writeType(spec, f)};`).join('\n')}
}

export function to${P}CreateData(draft: ${P}Draft): ${P}CreateData {
  return {
${fields.map((f) => `    ${f.name}: ${writeExpression(spec, f, 'draft')},`).join('\n')}
  };
}

/** The columns written on update. \`updatedAt\` is set here: Prisma 8 has no update hook. */
export interface ${P}UpdateData {
${fields.map((f) => `  ${f.name}?: ${writeType(spec, f)};`).join('\n')}
  updatedAt: string;
}

${update.functions}
export function to${P}UpdateData(changes: ${P}Changes, now: Date): ${P}UpdateData {
  return {
${update.calls}
    updatedAt: dateToInstant(now),
  };
}
`;
}

/** `infrastructure/prisma/prisma-<entity>.repository.ts` */
export function prismaRepositoryTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const unique = hasUnique(spec);
  const S = stem.upperSnake;
  const createFailure = unique
    ? `failures.orConflict('create', ${entity.camel}AlreadyExists)`
    : `failures.infraOnly('create')`;
  const updateFailure = unique
    ? `failures.orConflict('update', ${entity.camel}AlreadyExists)`
    : `failures.infraOnly('update')`;
  const errorTypes = [
    ...(unique ? ['ConflictAppError'] : []),
    'InfrastructureAppError',
    'NotFoundAppError',
  ];
  const createErrors = unique
    ? 'ConflictAppError | InfrastructureAppError'
    : 'InfrastructureAppError';
  const updateErrors = unique
    ? 'NotFoundAppError | ConflictAppError | InfrastructureAppError'
    : 'NotFoundAppError | InfrastructureAppError';

  return `import type { TenantId } from '@modules/auth';

import type { Clock } from '@lib/clock';
import { db, createPersistenceFailures } from '@lib/db';
import type { ${errorTypes.join(', ')} } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  ${S}_ERROR_CODES,
${unique ? `  ${entity.camel}AlreadyExists,\n` : ''}  ${entity.camel}NotFound,
} from '../../domain/errors/${stem.kebab}-errors';

import {
  ${entity.upperSnake}_SELECT,
  to${P},
  to${P}CreateData,
  to${P}UpdateData,
} from './${entity.kebab}-record-mapper';

import type { ${P}Id } from '../../domain/models/ids';
import type { ${P}, ${P}Changes } from '../../domain/models/${entity.kebab}';
import type { New${P}, ${P}Repository } from '../../domain/ports/${entity.kebab}.repository';

const failures = createPersistenceFailures({
  module: '${stem.snake}.persistence',
  code: ${S}_ERROR_CODES.persistenceFailed,
  subject: '${P}',
});

const ${entities.camel} = () => db.orm.public.${P}.select(...${entity.upperSnake}_SELECT);

/**
 * Prisma 8 repository for ${entity.kebab.replaceAll('-', ' ')}s.
 *
 * - Query results are awaitable but not \`Promise\`s, so each thunk is \`async\`
 *   and returns the query directly: the async wrapper awaits it.
 * Failure conventions (see \`createPersistenceFailures\`):
 * - reads and idempotent deletes -> \`infraOnly\`
 * - writes that can hit a unique constraint -> \`orConflict\`
 * - single-row writes -> \`requireRow\` (Prisma 8 \`update()\` resolves to \`null\` on a miss).
 */
export class Prisma${P}Repository implements ${P}Repository {
  constructor(private readonly clock: Clock) {}

  findById(id: ${P}Id, tenantId: TenantId): AppResultAsync<${P} | null, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => ${entities.camel}().where({ id, tenantId }).first(),
      failures.infraOnly('findById'),
    ).map((record) => record && to${P}(record));
  }

  listByTenant(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ${P}[], InfrastructureAppError> {
    return fromThrowableAsync(
      async () =>
        ${entities.camel}()
          .where({ tenantId })
          // \`id\` breaks ties so the order is stable between requests.
          .orderBy([(row) => row.updatedAt.desc(), (row) => row.id.asc()])
          .limit(limit)
          .all(),
      failures.infraOnly('listByTenant'),
    ).map((records) => records.map(to${P}));
  }

  create(input: New${P}): AppResultAsync<${P}, ${createErrors}> {
    const { tenantId, draft } = input;
    return fromThrowableAsync(
      async () => ${entities.camel}().create({ tenantId, ...to${P}CreateData(draft) }),
      ${createFailure},
    ).map(to${P});
  }

  update(
    id: ${P}Id,
    tenantId: TenantId,
    changes: ${P}Changes,
  ): AppResultAsync<${P}, ${updateErrors}> {
    return fromThrowableAsync(
      async () =>
        ${entities.camel}()
          .where({ id, tenantId })
          .update(to${P}UpdateData(changes, this.clock.now())),
      ${updateFailure},
    )
      .andThen(failures.requireRow(${entity.camel}NotFound))
      .map(to${P});
  }

  deleteById(id: ${P}Id, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError> {
    return fromThrowableAsync(
      async () => db.orm.public.${P}.where({ id, tenantId }).deleteAndCount(),
      failures.infraOnly('deleteById'),
    ).map(() => undefined);
  }
}
`;
}

/** `infrastructure/audit/logger-<stem>-audit-log.ts` */
export function auditLoggerTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  return `import { createAuditLog } from '@lib/logger';

import type {
  ${stem.pascal}AuditLog,
  ${stem.pascal}Event,
} from '../../domain/ports/${stem.kebab}-audit-log.port';

/** Failures are \`warn\` so alerting can key on them. Exhaustive per event type. */
const LEVEL_BY_EVENT = {
  '${entity.snake}.created': 'info',
  '${entity.snake}.updated': 'info',
  '${entity.snake}.deleted': 'info',
} as const satisfies Record<${stem.pascal}Event['type'], 'info' | 'warn'>;

/** One structured log line per event under \`${stem.kebab}.audit\`; never throws. */
export const logger${stem.pascal}AuditLog: ${stem.pascal}AuditLog = createAuditLog(
  '${stem.kebab}.audit',
  LEVEL_BY_EVENT,
);
`;
}

export { hasDates };
