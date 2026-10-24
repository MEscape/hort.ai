import { enumConstName, enumTypeName, domainType, inputType } from '../lib/fields';
import { hasKind, hasUnique } from '../lib/spec';

import type { Field } from '../lib/fields';
import type { ModuleSpec } from '../lib/spec';

const VALIDATION_CODE_SEGMENT = {
  required: 'required',
  tooLong: 'too_long',
  numberInvalid: 'number_invalid',
  amountInvalid: 'amount_invalid',
  dateInvalid: 'date_invalid',
  optionUnknown: 'option_unknown',
} as const;

export const TEXT_MAX = 200;

const stringFields = (spec: ModuleSpec): Field[] => spec.fields.filter((f) => f.kind === 'string');
const enumFields = (spec: ModuleSpec): Field[] => spec.fields.filter((f) => f.kind === 'enum');

/** `domain/errors/<stem>-errors.ts` */
export function errorsTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const S = stem.upperSnake;
  const unique = hasUnique(spec);
  const imports = [
    ...(unique ? ['conflictError'] : []),
    'notFoundError',
    'validationError',
    'FieldErrorBag',
  ];
  const typeImports = [
    ...(unique ? ['ConflictAppError'] : []),
    'NotFoundAppError',
    'ValidationAppError',
  ];

  return `import { ${imports.join(', ')} } from '@lib/errors';
import type { ${typeImports.join(', ')} } from '@lib/errors';

/**
 * Stable codes. Presentation maps these to translation keys (i18n.md);
 * nothing here is user-facing prose.
 *
 * \`notFound\` is deliberately the ONE outcome for "no such ${entity.kebab}" and
 * "${entity.kebab} belongs to another tenant": codes reach the client, and a
 * separate code would disclose that the id exists elsewhere.
 */
export const ${S}_ERROR_CODES = {
  notFound: '${entity.snake}.not_found',
${unique ? `  alreadyExists: '${entity.snake}.already_exists',\n` : ''}  validationFailed: '${stem.snake}.validation_failed',
  persistenceFailed: '${stem.snake}.persistence_failed',
} as const;

/** Field-level codes, carried in \`fieldErrors\`. Also stable, also never prose. */
export const ${S}_VALIDATION_CODES = {
  idInvalid: '${stem.snake}.validation.id_invalid',
${spec.validationCodes.map((code) => `  ${code}: '${stem.snake}.validation.${VALIDATION_CODE_SEGMENT[code]}',`).join('\n')}
} as const;

export type ${stem.pascal}ErrorCode = (typeof ${S}_ERROR_CODES)[keyof typeof ${S}_ERROR_CODES];
export type ${stem.pascal}ValidationCode =
  (typeof ${S}_VALIDATION_CODES)[keyof typeof ${S}_VALIDATION_CODES];
export type ${stem.pascal}Code = ${stem.pascal}ErrorCode | ${stem.pascal}ValidationCode;

/** Also covers another tenant's ${entity.kebab}: see \`${S}_ERROR_CODES\`. */
export function ${entity.camel}NotFound(): NotFoundAppError {
  return notFoundError(${S}_ERROR_CODES.notFound, 'The ${entity.kebab.replaceAll('-', ' ')} was not found.');
}
${
  unique
    ? `
/** A unique field (${spec.unique.map((f) => f.name).join(', ')}) is already used within the tenant. */
export function ${entity.camel}AlreadyExists(): ConflictAppError {
  return conflictError(
    ${S}_ERROR_CODES.alreadyExists,
    'A ${entity.kebab.replaceAll('-', ' ')} with these values already exists.',
  );
}
`
    : ''
}
export function ${stem.camel}ValidationFailed(fieldErrors: Record<string, string[]>): ValidationAppError {
  return validationError(
    ${S}_ERROR_CODES.validationFailed,
    'The ${entity.kebab.replaceAll('-', ' ')} input is invalid.',
    fieldErrors,
  );
}

/** One place wires the bag to this module's error factory. */
export function create${stem.pascal}ErrorBag(): FieldErrorBag {
  return new FieldErrorBag(${stem.camel}ValidationFailed);
}

/** A validation failure on a single field. */
export function fieldValidationFailed(
  field: string,
  code: ${stem.pascal}ValidationCode,
): ValidationAppError {
  return ${stem.camel}ValidationFailed({ [field]: [code] });
}
`;
}

/** `domain/models/ids.ts` */
export function idsTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const E = entity.upperSnake;
  return `import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { ${stem.upperSnake}_VALIDATION_CODES, fieldValidationFailed } from '../errors/${stem.kebab}-errors';

/** Opaque identity of ${/^[aeiou]/.test(entity.kebab) ? 'an' : 'a'} ${entity.kebab.replaceAll('-', ' ')}. */
export type ${entity.pascal}Id = Brand<string, '${entity.pascal}Id'>;

export const ${E}_ID_MAX_LENGTH = 128;

/**
 * Brands an id read from storage. Only infrastructure adapters call this;
 * request values go through \`parse${entity.pascal}Id\`.
 */
export function to${entity.pascal}Id(raw: string): ${entity.pascal}Id {
  return raw as ${entity.pascal}Id; // Brand constructor: the cast is only permitted here.
}

/** Brands an id that arrived from a request, after checking its shape. */
export const parse${entity.pascal}Id = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= ${E}_ID_MAX_LENGTH,
  brand: to${entity.pascal}Id,
  mapError: () => fieldValidationFailed('id', ${stem.upperSnake}_VALIDATION_CODES.idInvalid),
});
`;
}

/** `domain/models/<entity>.ts` */
export function modelTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const E = entity.upperSnake;
  const P = entity.pascal;
  const strings = stringFields(spec);
  const enums = enumFields(spec);
  const codeUse = spec.validationCodes.length > 0;
  const hasText = strings.length > 0;
  /** Only fields with a validation rule take the error bag. */
  const needsBag = fields.some((f) => f.kind !== 'boolean');

  const header = `import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
${enums.length > 0 ? `import { literalGuard } from '@lib/utils';\n` : ''}import type { ${needsBag ? 'FieldErrorBag, ' : ''}ValidationAppError } from '@lib/errors';
import type { TenantId } from '@modules/auth';

import { create${stem.pascal}ErrorBag${codeUse ? `, ${stem.upperSnake}_VALIDATION_CODES` : ''} } from '../errors/${stem.kebab}-errors';

import type { ${P}Id } from './ids';
`;

  const limits = hasText
    ? `/** Field bounds. Presentation reads them through the application's constraints contract. */
export const ${E}_LIMITS = {
${strings.map((f) => `  ${f.name}Max: ${TEXT_MAX},`).join('\n')}
} as const;
`
    : '';

  const enumBlocks = enums
    .map((f) => {
      const typeName = enumTypeName(P, f);
      const constName = enumConstName(E, f);
      return `export const ${constName} = [${f.enumValues.map((v) => `'${v}'`).join(', ')}] as const;
export type ${typeName} = (typeof ${constName})[number];
export const is${typeName} = literalGuard(${constName});
`;
    })
    .join('\n');

  const entityFields = fields.map((f) => `  readonly ${f.name}: ${domainType(f, P)};`).join('\n');
  const draftInputFields = fields
    .map((f) =>
      f.optional
        ? `  readonly ${f.name}?: ${inputType(f)} | undefined;`
        : `  readonly ${f.name}: ${inputType(f)};`,
    )
    .join('\n');
  const changesInputFields = fields
    .map((f) => `  readonly ${f.name}?: ${inputType(f)} | undefined;`)
    .join('\n');
  const changesFields = fields.map((f) => `  readonly ${f.name}?: ${domainType(f, P)};`).join('\n');

  const helpers = [
    hasText
      ? `/** Which field a text check reports on, and how long it may be. */
interface TextRule {
  readonly field: string;
  readonly max: number;
}
`
      : '',
    strings.some((f) => !f.optional)
      ? `function checkRequiredText(value: string, rule: TextRule, bag: FieldErrorBag): void {
  if (value.length === 0) {
    bag.add(rule.field, CODES.required);
  } else if (value.length > rule.max) {
    bag.add(rule.field, CODES.tooLong);
  }
}
`
      : '',
    strings.some((f) => f.optional)
      ? `function checkOptionalText(value: string | null, rule: TextRule, bag: FieldErrorBag): void {
  if (value !== null && value.length > rule.max) {
    bag.add(rule.field, CODES.tooLong);
  }
}

/** Blank text is "no value": it is stored as \`null\`, never as an empty string. */
function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}
`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const readers = fields
    .map((f) => draftReader(f, P))
    .filter((source): source is string => source !== null)
    .join('\n');
  const appliers = fields.map((f) => changeApplier(f, P)).join('\n');
  const readCalls = fields.map((f) => `  const ${f.name} = ${readCall(f)};`).join('\n');
  const requiredEnums = fields.filter((f) => f.kind === 'enum' && !f.optional);

  return `${header}
${codeUse ? `const CODES = ${stem.upperSnake}_VALIDATION_CODES;\n` : ''}
${limits}
${enumBlocks}
/** A stored ${entity.kebab.replaceAll('-', ' ')}. The tenant is internal and never leaves the module's views. */
export interface ${P} {
  readonly id: ${P}Id;
  readonly tenantId: TenantId;
${entityFields}
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Raw input for a new ${entity.kebab.replaceAll('-', ' ')}, before validation. */
export interface ${P}DraftInput {
${draftInputFields}
}

/** A validated ${entity.kebab.replaceAll('-', ' ')}, ready to be stored. */
export interface ${P}Draft {
${entityFields}
}

/** \`undefined\` leaves a field alone${fields.some((f) => f.optional) ? '; `null` clears an optional one' : ''}. */
export interface ${P}ChangesInput {
${changesInputFields}
}

export interface ${P}Changes {
${changesFields}
}

${helpers}
${readers}
${appliers}
/** The only way a new ${entity.kebab.replaceAll('-', ' ')} enters the system. Reports every invalid field. */
export function create${P}Draft(input: ${P}DraftInput): AppResult<${P}Draft, ValidationAppError> {
  const bag = create${stem.pascal}ErrorBag();
${readCalls}

  if (bag.hasErrors${requiredEnums.map((f) => ` || ${f.name} === null`).join('')}) {
    return err(bag.toError());
  }
  return ok({ ${fields.map((f) => f.name).join(', ')} });
}

/** Validates a partial update; only the fields that were provided are checked. */
export function parse${P}Changes(
  input: ${P}ChangesInput,
): AppResult<${P}Changes, ValidationAppError> {
  const bag = create${stem.pascal}ErrorBag();
  const changes: ${P}Changes = {
${fields.map((f) => `    ...change${cap(f.name)}(${f.kind === 'boolean' ? 'input' : 'input, bag'}),`).join('\n')}
  };

  return bag.hasErrors ? err(bag.toError()) : ok(changes);
}

export function isEmptyChanges(changes: ${P}Changes): boolean {
  return Object.keys(changes).length === 0;
}
`;
}

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** How `createXDraft` obtains one field: inline for booleans, otherwise through its reader. */
function readCall(f: Field): string {
  return f.kind === 'boolean' ? `input.${f.name}` : `read${cap(f.name)}(input, bag)`;
}

/** A function validating one field of a new entity; `null` for fields that need none. */
function draftReader(f: Field, P: string): string | null {
  const n = f.name;
  const E = enumTypeName(P, f);
  const head = (returns: string): string =>
    `function read${cap(n)}(input: ${P}DraftInput, bag: FieldErrorBag): ${returns} {`;
  const rule = `{ field: '${n}', max: ${leading(P)}_LIMITS.${n}Max }`;
  switch (f.kind) {
    case 'string':
      return f.optional
        ? `${head('string | null')}
  const value = normalizeOptionalText(input.${n});
  checkOptionalText(value, ${rule}, bag);
  return value;
}
`
        : `${head('string')}
  const value = input.${n}.trim();
  checkRequiredText(value, ${rule}, bag);
  return value;
}
`;
    case 'number':
      return `${head(f.optional ? 'number | null' : 'number')}
  const value = input.${n}${f.optional ? ' ?? null' : ''};
  if (${f.optional ? 'value !== null && ' : ''}!Number.isFinite(value)) {
    bag.add('${n}', CODES.numberInvalid);
  }
  return value;
}
`;
    case 'money':
      return `${head(f.optional ? 'number | null' : 'number')}
  const value = input.${n}${f.optional ? ' ?? null' : ''};
  if (${f.optional ? 'value !== null && ' : ''}!(Number.isInteger(value) && value >= 0)) {
    bag.add('${n}', CODES.amountInvalid);
  }
  return value;
}
`;
    case 'date':
      return `${head(f.optional ? 'Date | null' : 'Date')}
  const value = input.${n}${f.optional ? ' ?? null' : ''};
  if (${f.optional ? 'value !== null && ' : ''}Number.isNaN(value.getTime())) {
    bag.add('${n}', CODES.dateInvalid);
  }
  return value;
}
`;
    case 'enum':
      return f.optional
        ? `${head(`${E} | null`)}
  const raw = input.${n} ?? null;
  if (raw === null) {
    return null;
  }
  if (!is${E}(raw)) {
    bag.add('${n}', CODES.optionUnknown);
    return null;
  }
  return raw;
}
`
        : `${head(`${E} | null`)}
  if (!is${E}(input.${n})) {
    bag.add('${n}', CODES.optionUnknown);
    return null;
  }
  return input.${n};
}
`;
    case 'boolean':
      return null;
  }
}

/** A function validating one provided field of a partial update; returns just that change. */
function changeApplier(f: Field, P: string): string {
  const n = f.name;
  const E = enumTypeName(P, f);
  const head = (withBag: boolean): string =>
    `function change${cap(n)}(input: ${P}ChangesInput${withBag ? ', bag: FieldErrorBag' : ''}): ${P}Changes {
  if (input.${n} === undefined) {
    return {};
  }`;
  const rule = `{ field: '${n}', max: ${leading(P)}_LIMITS.${n}Max }`;
  const nullGuard = f.optional ? `input.${n} !== null && ` : '';
  switch (f.kind) {
    case 'string':
      return f.optional
        ? `${head(true)}
  const value = normalizeOptionalText(input.${n});
  checkOptionalText(value, ${rule}, bag);
  return { ${n}: value };
}
`
        : `${head(true)}
  const value = input.${n}.trim();
  checkRequiredText(value, ${rule}, bag);
  return { ${n}: value };
}
`;
    case 'number':
      return `${head(true)}
  if (${nullGuard}!Number.isFinite(input.${n})) {
    bag.add('${n}', CODES.numberInvalid);
  }
  return { ${n}: input.${n} };
}
`;
    case 'money':
      return `${head(true)}
  if (${nullGuard}!(Number.isInteger(input.${n}) && input.${n} >= 0)) {
    bag.add('${n}', CODES.amountInvalid);
  }
  return { ${n}: input.${n} };
}
`;
    case 'boolean':
      return `${head(false)}
  return { ${n}: input.${n} };
}
`;
    case 'date':
      return `${head(true)}
  if (${nullGuard}Number.isNaN(input.${n}.getTime())) {
    bag.add('${n}', CODES.dateInvalid);
  }
  return { ${n}: input.${n} };
}
`;
    case 'enum':
      return f.optional
        ? `${head(true)}
  if (input.${n} === null) {
    return { ${n}: null };
  }
  if (!is${E}(input.${n})) {
    bag.add('${n}', CODES.optionUnknown);
    return {};
  }
  return { ${n}: input.${n} };
}
`
        : `${head(true)}
  if (!is${E}(input.${n})) {
    bag.add('${n}', CODES.optionUnknown);
    return {};
  }
  return { ${n}: input.${n} };
}
`;
  }
}

/** `ITEM` from `Item` (limits constant prefix is the entity's upper-snake name). */
function leading(pascal: string): string {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}

/** `domain/ports/<entity>.repository.ts` */
export function repositoryPortTemplate(spec: ModuleSpec): string {
  const { entity } = spec;
  const P = entity.pascal;
  const unique = hasUnique(spec);
  const writeErrors = unique
    ? 'ConflictAppError | InfrastructureAppError'
    : 'InfrastructureAppError';
  const updateErrors = unique
    ? 'NotFoundAppError | ConflictAppError | InfrastructureAppError'
    : 'NotFoundAppError | InfrastructureAppError';
  const errorTypes = [
    ...(unique ? ['ConflictAppError'] : []),
    'InfrastructureAppError',
    'NotFoundAppError',
  ];

  return `import type { TenantId } from '@modules/auth';

import type { ${errorTypes.join(', ')} } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ${P}Id } from '../models/ids';
import type { ${P}, ${P}Changes, ${P}Draft } from '../models/${entity.kebab}';

export interface New${P} {
  readonly tenantId: TenantId;
  readonly draft: ${P}Draft;
}

/**
 * Persistence for ${entity.kebab.replaceAll('-', ' ')}s. Every read and write takes the tenant and
 * matches on (id, tenantId), so another tenant's id behaves exactly like
 * an id that does not exist.
 *
 * Finders return \`null\` for "absent"; deciding that absence is an error is
 * the use case's job. Adapters translate every driver failure into our own
 * error kinds before returning (errors.md).
 */
export interface ${P}Repository {
  findById(id: ${P}Id, tenantId: TenantId): AppResultAsync<${P} | null, InfrastructureAppError>;

  /** Bounded: never returns more than \`limit\` items (performance.md). */
  listByTenant(
    tenantId: TenantId,
    limit: number,
  ): AppResultAsync<readonly ${P}[], InfrastructureAppError>;

  create(input: New${P}): AppResultAsync<${P}, ${writeErrors}>;

  update(
    id: ${P}Id,
    tenantId: TenantId,
    changes: ${P}Changes,
  ): AppResultAsync<${P}, ${updateErrors}>;

  /** Idempotent: deleting a ${entity.kebab.replaceAll('-', ' ')} that is already gone succeeds. */
  deleteById(id: ${P}Id, tenantId: TenantId): AppResultAsync<void, InfrastructureAppError>;
}
`;
}

/** `domain/ports/<stem>-audit-log.port.ts` */
export function auditPortTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const P = entity.pascal;
  const changed = fields.map((f) => `'${f.name}'`).join(' | ');
  const base = (type: string, extra = ''): string => `  | {
      readonly type: '${entity.snake}.${type}';
      readonly actorId: ActorId;
      readonly tenantId: TenantId;
      readonly ${entity.camel}Id: ${P}Id;${extra}
    }`;
  return `import type { ActorId, TenantId } from '@modules/auth';

import type { ${P}Id } from '../models/ids';

/**
 * Business facts worth keeping. Free of content: field names and ids only,
 * never the values themselves. Adding a variant forces the sink's level
 * table to be updated.
 */
export type ${stem.pascal}Event =
${base('created')}
${base('updated', `\n      readonly changedFields: ReadonlyArray<${changed}>;`)}
${base('deleted')};

/** Append-only. \`record\` is synchronous and MUST NOT throw or block. */
export interface ${stem.pascal}AuditLog {
  record(event: ${stem.pascal}Event): void;
}
`;
}

export { hasKind };
