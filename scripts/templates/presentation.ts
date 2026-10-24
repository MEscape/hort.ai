import { enumConstName, enumTypeName, domainType } from '../lib/fields';
import { hasUnique } from '../lib/spec';

import type { Field } from '../lib/fields';
import type { ModuleSpec } from '../lib/spec';

const cap = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);
const schemaName = (spec: ModuleSpec, f: Field): string =>
  `${spec.entity.camel}${cap(f.name)}Schema`;

function fieldSchema(spec: ModuleSpec, f: Field): string {
  const E = spec.entity.upperSnake;
  switch (f.kind) {
    case 'string':
      return f.optional
        ? `z.string().trim().max(${E}_LIMITS.${f.name}Max, { message: CODES.tooLong })`
        : `z
  .string()
  .trim()
  .min(1, { message: CODES.required })
  .max(${E}_LIMITS.${f.name}Max, { message: CODES.tooLong })`;
    case 'number':
      return `z.number({ message: CODES.numberInvalid })`;
    case 'money':
      return `z
  .number({ message: CODES.amountInvalid })
  .int({ message: CODES.amountInvalid })
  .min(0, { message: CODES.amountInvalid })`;
    case 'boolean':
      return 'z.boolean()';
    case 'date':
      return `z.coerce.date({ message: CODES.dateInvalid })`;
    case 'enum':
      return `z.enum(${enumConstName(E, f)}, { message: CODES.optionUnknown })`;
  }
}

/** `presentation/schemas/<entity>-fields-schema.ts` */
export function fieldsSchemaTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const E = entity.upperSnake;
  const strings = fields.some((f) => f.kind === 'string');
  const constants = [
    `${E}_ID_MAX_LENGTH`,
    ...(strings ? [`${E}_LIMITS`] : []),
    ...fields.filter((f) => f.kind === 'enum').map((f) => enumConstName(E, f)),
    `${stem.upperSnake}_VALIDATION_CODES as CODES`,
  ].sort((a, b) => a.localeCompare(b));

  return `import { z } from 'zod';

import {
  ${constants.join(',\n  ')},
} from '../../application/contracts/${stem.kebab}-constraints';

/**
 * Field schemas shared by the create and edit forms. Messages are stable
 * codes, never prose: the UI translates them (i18n.md). Limits come from
 * the domain constants, so a number is defined exactly once.
 */
export const ${entity.camel}IdSchema = z
  .string()
  .min(1, { message: CODES.idInvalid })
  .max(${E}_ID_MAX_LENGTH, { message: CODES.idInvalid });

${fields.map((f) => `export const ${schemaName(spec, f)} = ${fieldSchema(spec, f)};`).join('\n\n')}
`;
}

/** `presentation/schemas/new-<entity>-schema.ts` */
export function newSchemaTemplate(spec: ModuleSpec): string {
  const { entity, fields } = spec;
  const names = fields.map((f) => schemaName(spec, f)).sort();
  return `import { z } from 'zod';

import {
  ${names.join(',\n  ')},
} from './${entity.kebab}-fields-schema';

export const new${entity.pascal}Schema = z.object({
${fields
  .map((f) => `  ${f.name}: ${schemaName(spec, f)}${f.optional ? '.nullable().optional()' : ''},`)
  .join('\n')}
});

export type New${entity.pascal} = z.infer<typeof new${entity.pascal}Schema>;
`;
}

/** `presentation/schemas/<entity>-edit-schema.ts` */
export function editSchemaTemplate(spec: ModuleSpec): string {
  const { entity, fields } = spec;
  const names = [`${entity.camel}IdSchema`, ...fields.map((f) => schemaName(spec, f))].sort();
  return `import { z } from 'zod';

import {
  ${names.join(',\n  ')},
} from './${entity.kebab}-fields-schema';

/** Omitting a field leaves it alone${fields.some((f) => f.optional) ? '; `null` clears an optional one' : ''}. */
export const ${entity.camel}EditSchema = z.object({
  id: ${entity.camel}IdSchema,
${fields
  .map((f) => `  ${f.name}: ${schemaName(spec, f)}${f.optional ? '.nullable()' : ''}.optional(),`)
  .join('\n')}
});

export type ${entity.pascal}Edit = z.infer<typeof ${entity.camel}EditSchema>;
`;
}

/** `presentation/schemas/delete-<entity>-schema.ts` */
export function deleteSchemaTemplate(spec: ModuleSpec): string {
  const { entity } = spec;
  return `import { z } from 'zod';

import { ${entity.camel}IdSchema } from './${entity.kebab}-fields-schema';

export const delete${entity.pascal}Schema = z.object({ id: ${entity.camel}IdSchema });

export type Delete${entity.pascal} = z.infer<typeof delete${entity.pascal}Schema>;
`;
}

/** `presentation/schemas/parse-<stem>-input.ts` */
export function parseInputTemplate(spec: ModuleSpec): string {
  const { stem } = spec;
  return `import { createActionInputParser } from '@lib/actions';

import { ${stem.upperSnake}_ERROR_CODES } from '../../application/contracts/${stem.kebab}-constraints';

export const parse${stem.pascal}Input = createActionInputParser(${stem.upperSnake}_ERROR_CODES.validationFailed);
`;
}

/** `presentation/dto/<entity>-dto.ts` */
export function dtoTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const P = entity.pascal;
  const enumTypes = fields.filter((f) => f.kind === 'enum').map((f) => enumTypeName(P, f));

  const dtoType = (f: Field): string => {
    if (f.kind !== 'date') {
      return domainType(f, P);
    }
    return f.optional ? 'string | null' : 'string';
  };
  const mapField = (f: Field): string => {
    const value = `view.${f.name}`;
    if (f.kind !== 'date') {
      return value;
    }
    return f.optional
      ? `${value} === null ? null : ${value}.toISOString()`
      : `${value}.toISOString()`;
  };

  return `${
    enumTypes.length > 0
      ? `import type { ${enumTypes.join(', ')} } from '../../application/contracts/${stem.kebab}-constraints';\n`
      : ''
  }import type { ${P}View } from '../../application/contracts/${stem.kebab}-views';

/** The JSON-safe shape Server Actions return: dates as ISO-8601 strings. */
export interface ${P}Dto {
  readonly id: string;
${fields.map((f) => `  readonly ${f.name}: ${dtoType(f)};`).join('\n')}
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function to${P}Dto(view: ${P}View): ${P}Dto {
  return {
    id: view.id,
${fields.map((f) => `    ${f.name}: ${mapField(f)},`).join('\n')}
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
`;
}

/** `presentation/routes.ts` */
export function routesTemplate(spec: ModuleSpec): string {
  const { dir, stem } = spec;
  return `/**
 * Admin routes of the module, in one place so actions (cache invalidation)
 * and components (navigation) cannot drift apart.
 */
export const ${stem.camel}Routes = {
  list: () => '/${dir.kebab}',
  detail: (id: string) => \`/${dir.kebab}/\${id}\`,
} as const;
`;
}

const ACTION_IMPORTS = (
  spec: ModuleSpec,
  schemaImport: string,
  schemaFile: string,
  dto: boolean,
): string => {
  const { stem, entity } = spec;
  return `import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { ${stem.camel}Commands } from '../../composition';
${dto ? `import { to${entity.pascal}Dto } from '../dto/${entity.kebab}-dto';\n` : ''}import { ${stem.camel}Routes } from '../routes';
import { parse${stem.pascal}Input } from '../schemas/parse-${stem.kebab}-input';
import { ${schemaImport} } from '../schemas/${schemaFile}';
${dto ? `\nimport type { ${entity.pascal}Dto } from '../dto/${entity.kebab}-dto';\n` : ''}`;
};

/** `presentation/actions/create-<entity>-action.ts` */
export function createActionTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const P = entity.pascal;
  return `'use server';

${ACTION_IMPORTS(spec, `new${P}Schema`, `new-${entity.kebab}-schema`, true)}
export async function create${P}Action(input: unknown): Promise<ActionResult<${P}Dto>> {
  const result = await parse${stem.pascal}Input(new${P}Schema, input).asyncAndThen((command) =>
    ${stem.camel}Commands.create${P}.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(${stem.camel}Routes.list());
  }
  return toActionResult(result.map(to${P}Dto));
}
`;
}

/** `presentation/actions/update-<entity>-action.ts` */
export function updateActionTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const P = entity.pascal;
  return `'use server';

${ACTION_IMPORTS(spec, `${entity.camel}EditSchema`, `${entity.kebab}-edit-schema`, true)}
export async function update${P}Action(input: unknown): Promise<ActionResult<${P}Dto>> {
  const result = await parse${stem.pascal}Input(${entity.camel}EditSchema, input).asyncAndThen(
    (command) => ${stem.camel}Commands.update${P}.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(${stem.camel}Routes.list());
    revalidatePath(${stem.camel}Routes.detail(result.value.id));
  }
  return toActionResult(result.map(to${P}Dto));
}
`;
}

/** `presentation/actions/delete-<entity>-action.ts` */
export function deleteActionTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const P = entity.pascal;
  return `'use server';

${ACTION_IMPORTS(spec, `delete${P}Schema`, `delete-${entity.kebab}-schema`, false)}
export async function delete${P}Action(input: unknown): Promise<ActionResult<void>> {
  const result = await parse${stem.pascal}Input(delete${P}Schema, input).asyncAndThen((command) =>
    ${stem.camel}Commands.delete${P}.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(${stem.camel}Routes.list());
  }
  return toActionResult(result);
}
`;
}

const VALIDATION_MESSAGES = {
  required: { en: 'This field is required.', de: 'Dieses Feld ist erforderlich.' },
  tooLong: { en: 'This value is too long.', de: 'Dieser Wert ist zu lang.' },
  numberInvalid: { en: 'Enter a valid number.', de: 'Geben Sie eine gültige Zahl ein.' },
  amountInvalid: {
    en: 'Enter a whole, non-negative amount.',
    de: 'Geben Sie einen ganzzahligen, nicht negativen Betrag ein.',
  },
  dateInvalid: { en: 'Enter a valid date.', de: 'Geben Sie ein gültiges Datum ein.' },
  optionUnknown: {
    en: 'Choose one of the available options.',
    de: 'Wählen Sie eine der verfügbaren Optionen.',
  },
} as const;

/** `presentation/i18n/<locale>.json` */
export function i18nTemplate(spec: ModuleSpec, locale: 'en' | 'de'): string {
  const errors =
    locale === 'en'
      ? {
          notFound: 'The entry was not found.',
          ...(hasUnique(spec)
            ? { alreadyExists: 'An entry with these values already exists.' }
            : {}),
          validation: 'Please check your input.',
          infrastructure: 'A service error occurred. Please try again later.',
          unexpected: 'An unexpected error occurred.',
        }
      : {
          notFound: 'Der Eintrag wurde nicht gefunden.',
          ...(hasUnique(spec)
            ? { alreadyExists: 'Ein Eintrag mit diesen Werten existiert bereits.' }
            : {}),
          validation: 'Bitte überprüfen Sie Ihre Eingaben.',
          infrastructure: 'Ein Dienstfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
          unexpected: 'Ein unerwarteter Fehler ist aufgetreten.',
        };
  const validation: Record<string, string> = {
    idInvalid: locale === 'en' ? 'The identifier is invalid.' : 'Die Kennung ist ungültig.',
  };
  for (const code of spec.validationCodes) {
    validation[code] = VALIDATION_MESSAGES[code][locale];
  }

  return `${JSON.stringify({ [spec.dir.camel]: { errors, validation } }, null, 2)}\n`;
}

/** `presentation/messages/message-keys.ts` */
export function messageKeysTemplate(spec: ModuleSpec): string {
  const { stem, dir } = spec;
  const S = stem.upperSnake;
  const unique = hasUnique(spec);
  return `import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  ${S}_ERROR_CODES as ERRORS,
  ${S}_VALIDATION_CODES as VALIDATION,
} from '../../application/contracts/${stem.kebab}-constraints';

import type { ${stem.pascal}Code } from '../../application/contracts/${stem.kebab}-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['${dir.camel}']>;

/**
 * Codes -> translation keys, relative to the \`${dir.camel}\` namespace.
 * \`satisfies Record<${stem.pascal}Code, ...>\` makes a new code fail to compile
 * until it has a message.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.notFound]: fieldPath('errors', 'notFound'),
${unique ? `  [ERRORS.alreadyExists]: fieldPath('errors', 'alreadyExists'),\n` : ''}  [ERRORS.validationFailed]: fieldPath('errors', 'validation'),
  [ERRORS.persistenceFailed]: fieldPath('errors', 'infrastructure'),
  [VALIDATION.idInvalid]: fieldPath('validation', 'idInvalid'),
${spec.validationCodes.map((code) => `  [VALIDATION.${code}]: fieldPath('validation', '${code}'),`).join('\n')}
} as const satisfies Record<${stem.pascal}Code, ValidKeys>;

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[${stem.pascal}Code] | typeof GENERIC_ERROR_MESSAGE_KEY;

function is${stem.pascal}Code(code: string): code is ${stem.pascal}Code {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/**
 * Codes from other modules (authorization, for instance) or from Zod's own
 * structural messages are unknown here and get the generic message.
 */
export function messageKeyForCode(code: string): MessageKey {
  return is${stem.pascal}Code(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}
`;
}
