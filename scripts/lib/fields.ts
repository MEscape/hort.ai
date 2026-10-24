import { CliError } from './args';
import { toCamel, toPascal, toUpperSnake } from './names';

/**
 * Field DSL: `name:type[?]` or `name:enum(a|b)[?]`.
 *
 *   title:string          required text (trimmed, bounded)
 *   note:string?          optional text; null clears it
 *   quantity:number       finite number (stored as Float)
 *   amountCents:money     non-negative integer minor units (stored as Int)
 *   isActive:boolean      required boolean
 *   dueAt:date?           instant (Date)
 *   status:enum(draft|sent|paid)
 *
 * `id`, `tenantId`, `createdAt` and `updatedAt` are always generated.
 */
export type FieldKind = 'string' | 'number' | 'money' | 'boolean' | 'date' | 'enum';

export interface Field {
  /** camelCase property name. */
  readonly name: string;
  readonly kind: FieldKind;
  readonly optional: boolean;
  /** `enum` only: lowercase snake_case domain values. */
  readonly enumValues: readonly string[];
}

const KINDS: readonly FieldKind[] = ['string', 'number', 'money', 'boolean', 'date', 'enum'];
/** Generated properties plus identifiers the templates use as local variables. */
const RESERVED_NAMES = new Set([
  'id',
  'tenantId',
  'createdAt',
  'updatedAt',
  'bag',
  'input',
  'changes',
  'ok',
  'err',
  'draft',
]);
const JS_RESERVED = new Set([
  'class',
  'default',
  'delete',
  'function',
  'new',
  'return',
  'this',
  'var',
]);
export const MAX_FIELDS = 30;

const FIELD_SPEC = /^([a-z][A-Za-z0-9]*):([a-z]+)(?:\(([^)]*)\))?(\?)?$/;
const ENUM_VALUE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

export function parseFields(specs: readonly string[]): Field[] {
  if (specs.length === 0) {
    throw new CliError('At least one field is required, e.g. --fields "name:string,note:string?".');
  }
  if (specs.length > MAX_FIELDS) {
    throw new CliError(`At most ${MAX_FIELDS} fields are supported (got ${specs.length}).`);
  }
  const seen = new Set<string>();

  return specs.map((spec) => {
    const match = FIELD_SPEC.exec(spec);
    if (!match) {
      throw new CliError(
        `Invalid field "${spec}". Expected name:type, name:type? or name:enum(a|b); names are camelCase.`,
      );
    }
    const [, name = '', rawKind = '', rawEnum, optionalMark] = match;
    const kind = KINDS.find((candidate) => candidate === rawKind);
    if (kind === undefined) {
      throw new CliError(
        `Unknown field type "${rawKind}" in "${spec}". Valid: ${KINDS.join(', ')}.`,
      );
    }
    if (RESERVED_NAMES.has(name) || JS_RESERVED.has(name)) {
      throw new CliError(`"${name}" cannot be a field name (generated or reserved).`);
    }
    if (seen.has(name)) {
      throw new CliError(`Duplicate field "${name}".`);
    }
    seen.add(name);

    const optional = optionalMark === '?';
    if (kind === 'boolean' && optional) {
      throw new CliError(
        `Boolean field "${name}" cannot be optional; use an enum for tri-state values.`,
      );
    }
    if (kind !== 'enum' && rawEnum !== undefined) {
      throw new CliError(`Only enum fields take values: "${spec}".`);
    }

    const enumValues = (rawEnum ?? '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
    if (kind === 'enum') {
      if (enumValues.length < 2) {
        throw new CliError(`Enum field "${name}" needs at least two values: ${name}:enum(a|b).`);
      }
      const bad = enumValues.find((value) => !ENUM_VALUE.test(value));
      if (bad !== undefined) {
        throw new CliError(`Enum value "${bad}" of "${name}" must be lowercase snake_case.`);
      }
      if (new Set(enumValues).size !== enumValues.length) {
        throw new CliError(`Enum field "${name}" has duplicate values.`);
      }
    }
    return { name, kind, optional, enumValues };
  });
}

/** Validates `--unique` against the declared fields. Unique fields are scoped to the tenant. */
export function resolveUnique(names: readonly string[], fields: readonly Field[]): Field[] {
  return names.map((raw) => {
    const name = toCamel(raw);
    const field = fields.find((candidate) => candidate.name === name);
    if (!field) {
      throw new CliError(`--unique "${raw}" is not a declared field.`);
    }
    if (field.optional || field.kind === 'boolean') {
      throw new CliError(`--unique "${raw}" must be a required, non-boolean field.`);
    }
    return field;
  });
}

// --- Spellings derived from a field ---------------------------------------

/** Domain union name for an enum field: `ItemStatus`. */
export const enumTypeName = (entityPascal: string, field: Field): string =>
  `${entityPascal}${toPascal(field.name)}`;

/** Constant holding an enum's domain values: `ITEM_STATUSES`. */
export function enumConstName(entityUpperSnake: string, field: Field): string {
  const upper = toUpperSnake(field.name);
  const plural = /(s|x|z|ch|sh)$/i.test(upper) ? `${upper}ES` : `${upper}S`;
  return `${entityUpperSnake}_${plural}`;
}

/** Prisma enum name: `ItemStatus`. */
export const prismaEnumName = enumTypeName;

/** TypeScript type of the validated domain value. */
export function domainType(field: Field, entityPascal: string): string {
  const base = (() => {
    switch (field.kind) {
      case 'string':
        return 'string';
      case 'number':
      case 'money':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'Date';
      case 'enum':
        return enumTypeName(entityPascal, field);
    }
  })();
  return field.optional ? `${base} | null` : base;
}

/** TypeScript type accepted from a request (before validation). */
export function inputType(field: Field): string {
  const base = (() => {
    switch (field.kind) {
      case 'string':
      case 'enum':
        return 'string';
      case 'number':
      case 'money':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
        return 'Date';
    }
  })();
  return field.optional ? `${base} | null` : base;
}

/** Prisma scalar for the printed schema snippet. */
export function prismaType(field: Field, entityPascal: string): string {
  const base = (() => {
    switch (field.kind) {
      case 'string':
        return 'String';
      case 'number':
        return 'Float';
      case 'money':
        return 'Int';
      case 'boolean':
        return 'Boolean';
      case 'date':
        return 'DateTime';
      case 'enum':
        return prismaEnumName(entityPascal, field);
    }
  })();
  return field.optional ? `${base}?` : base;
}

/** Validation codes a set of fields needs (besides `idInvalid`). */
export type ValidationCode =
  'required' | 'tooLong' | 'numberInvalid' | 'amountInvalid' | 'dateInvalid' | 'optionUnknown';

export function requiredValidationCodes(fields: readonly Field[]): ValidationCode[] {
  const codes = new Set<ValidationCode>();
  for (const field of fields) {
    switch (field.kind) {
      case 'string':
        codes.add('tooLong');
        if (!field.optional) {
          codes.add('required');
        }
        break;
      case 'number':
        codes.add('numberInvalid');
        break;
      case 'money':
        codes.add('amountInvalid');
        break;
      case 'date':
        codes.add('dateInvalid');
        break;
      case 'enum':
        codes.add('optionUnknown');
        break;
      case 'boolean':
        break;
    }
  }
  const order: ValidationCode[] = [
    'required',
    'tooLong',
    'numberInvalid',
    'amountInvalid',
    'dateInvalid',
    'optionUnknown',
  ];
  return order.filter((code) => codes.has(code));
}
