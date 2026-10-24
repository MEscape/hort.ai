import { requiredValidationCodes } from './fields';
import { assertKebabName, nameSet, pluralize, singularize } from './names';

import type { Field, ValidationCode } from './fields';
import type { NameSet } from './names';

/**
 * Everything the module templates need, derived once.
 *
 * Three identifiers (docs: scripts/CONVENTIONS.md):
 *  - `dir`    the module folder and i18n namespace, possibly plural (`lesson-plans`)
 *  - `stem`   module-level files and symbols (`lesson-plan-errors.ts`, `dataSourceCommands`)
 *  - `entity` entity-level files and symbols (`prisma-item.repository.ts`, `ItemView`)
 */
export interface ModuleSpec {
  readonly dir: NameSet;
  readonly stem: NameSet;
  readonly entity: NameSet;
  /** Plural of the entity, for collection variables (`items`). */
  readonly entities: NameSet;
  /** Permission resource token: entity name, lowercase, no separators (`lessonplan`). */
  readonly permission: string;
  readonly fields: readonly Field[];
  readonly unique: readonly Field[];
  readonly validationCodes: readonly ValidationCode[];
  readonly withClient: boolean;
  readonly withTests: boolean;
}

export interface SpecInput {
  readonly module: string;
  readonly stem?: string | undefined;
  readonly entity?: string | undefined;
  readonly fields: readonly Field[];
  readonly unique: readonly Field[];
  readonly withClient: boolean;
  readonly withTests: boolean;
}

export function buildSpec(input: SpecInput): ModuleSpec {
  const dirName = assertKebabName(input.module, 'module name');
  const stemName = assertKebabName(input.stem ?? singularize(dirName), 'stem');
  const entityName = assertKebabName(input.entity ?? stemName, 'entity name');
  const entitiesName = pluralize(entityName);
  return {
    dir: nameSet(dirName),
    stem: nameSet(stemName),
    entity: nameSet(entityName),
    entities: nameSet(entitiesName),
    permission: entityName.replaceAll('-', ''),
    fields: input.fields,
    unique: input.unique,
    validationCodes: requiredValidationCodes(input.fields),
    withClient: input.withClient,
    withTests: input.withTests,
  };
}

/** Domain-level helpers shared by templates. */
export const hasUnique = (spec: ModuleSpec): boolean => spec.unique.length > 0;
export const hasKind = (spec: ModuleSpec, kind: Field['kind']): boolean =>
  spec.fields.some((field) => field.kind === kind);
