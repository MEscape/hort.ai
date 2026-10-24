import { enumConstName, enumTypeName, domainType } from '../lib/fields';
import { hasUnique } from '../lib/spec';

import type { ModuleSpec } from '../lib/spec';

const words = (kebab: string): string => kebab.replaceAll('-', ' ');

/** `application/<stem>-dependencies.ts` */
export function dependenciesTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  return `import type { AuthorizationService } from '@modules/auth';

import type { ${stem.pascal}AuditLog } from '../domain/ports/${stem.kebab}-audit-log.port';
import type { ${entity.pascal}Repository } from '../domain/ports/${entity.kebab}.repository';

/** What every protected ${words(stem.kebab)} use case is built from. */
export interface ${stem.pascal}Dependencies {
  readonly authorization: AuthorizationService;
  readonly ${entities.camel}: ${entity.pascal}Repository;
  readonly audit: ${stem.pascal}AuditLog;
}
`;
}

/** `application/<stem>-limits.ts` */
export function limitsTemplate(spec: ModuleSpec): string {
  const E = spec.entity.upperSnake;
  return `/** Every list is bounded (performance.md). Raise a limit deliberately, never by removing it. */
export const DEFAULT_${E}_LIST_LIMIT = 50;
export const MIN_${E}_LIST_LIMIT = 1;
export const MAX_${E}_LIST_LIMIT = 100;
`;
}

/** `application/<entity>-scope.ts` */
export function scopeTemplate(spec: ModuleSpec): string {
  const { entity } = spec;
  return `import type { ResourceScope } from '@modules/auth';

import type { ${entity.pascal} } from '../domain/models/${entity.kebab}';

/**
 * The scope authorization checks a loaded ${words(entity.kebab)} against. The tenant is
 * read from the stored record (\`${entity.camel}.tenantId\`), never from the request,
 * which is what makes the cross-tenant check a comparison instead of trust.
 */
export function scopeOf(${entity.camel}: ${entity.pascal}): ResourceScope {
  return { tenantId: ${entity.camel}.tenantId };
}
`;
}

/** `application/load-authorized-<entity>.ts` */
export function loadAuthorizedTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const c = entity.camel;
  return `import type { Actor, AuthorizationError, Permission } from '@modules/auth';

import type { InfrastructureAppError, NotFoundAppError, ValidationAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { ${c}NotFound } from '../domain/errors/${stem.kebab}-errors';
import { parse${P}Id } from '../domain/models/ids';

import { scopeOf } from './${entity.kebab}-scope';

import type { ${P} } from '../domain/models/${entity.kebab}';
import type { ${stem.pascal}Dependencies } from './${stem.kebab}-dependencies';

/** Everything an operation on one existing ${words(entity.kebab)} can fail with. */
export type Load${P}Error =
  AuthorizationError | ValidationAppError | NotFoundAppError | InfrastructureAppError;

export interface Authorized${P} {
  readonly actor: Actor;
  readonly ${c}: ${P};
}

/**
 * The shared first half of every operation on an existing ${words(entity.kebab)}:
 *
 *  1. \`requireInTenant\` FIRST, so a caller without the permission learns
 *     nothing about which ids exist.
 *  2. Look the ${words(entity.kebab)} up by (id, actor.tenantId): another tenant's id is
 *     simply "not found".
 *  3. \`requireOnResource\` against the STORED tenant, the backstop should a
 *     repository ever return a foreign record.
 */
export function loadAuthorized${P}(
  deps: ${stem.pascal}Dependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<Authorized${P}, Load${P}Error> {
  const { authorization, ${entities.camel} } = deps;

  return authorization.requireInTenant(permission).andThen((actor) =>
    parse${P}Id(rawId)
      .asyncAndThen((id) => ${entities.camel}.findById(id, actor.tenantId))
      .andThen((${c}): AppResultAsync<${P}, NotFoundAppError> =>
        ${c} === null ? errAsync(${c}NotFound()) : okAsync(${c}),
      )
      .andThen((${c}) =>
        authorization
          .requireOnResource(permission, scopeOf(${c}))
          .map((verifiedActor) => ({ actor: verifiedActor, ${c} })),
      ),
  );
}
`;
}

/** `application/<stem>-view-mappers.ts` */
export function viewMappersTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const P = entity.pascal;
  return `import type { ${P}View } from './contracts/${stem.kebab}-views';
import type { ${P} } from '../domain/models/${entity.kebab}';

export function to${P}View(${entity.camel}: ${P}): ${P}View {
  return {
    id: ${entity.camel}.id,
${fields.map((f) => `    ${f.name}: ${entity.camel}.${f.name},`).join('\n')}
    createdAt: ${entity.camel}.createdAt,
    updatedAt: ${entity.camel}.updatedAt,
  };
}
`;
}

/** `application/contracts/<stem>-constraints.ts` */
export function constraintsTemplate(spec: ModuleSpec): string {
  const { stem, entity, fields } = spec;
  const S = stem.upperSnake;
  const E = entity.upperSnake;
  const strings = fields.filter((f) => f.kind === 'string');
  const enums = fields.filter((f) => f.kind === 'enum');
  const modelValues = [
    ...(strings.length > 0 ? [`${E}_LIMITS`] : []),
    ...enums.map((f) => enumConstName(E, f)),
  ];
  const modelTypes = enums.map((f) => enumTypeName(entity.pascal, f));

  return `/**
 * Domain constants and codes that presentation legitimately needs (form
 * validation, option lists, message lookup). Presentation may not import
 * the domain, so they are re-exported here as part of the application's
 * contract. Nothing in this file is defined twice.
 */
export { ${S}_ERROR_CODES, ${S}_VALIDATION_CODES } from '../../domain/errors/${stem.kebab}-errors';
export type { ${stem.pascal}Code } from '../../domain/errors/${stem.kebab}-errors';
export { ${E}_ID_MAX_LENGTH } from '../../domain/models/ids';
${
  modelValues.length > 0
    ? `export { ${modelValues.join(', ')} } from '../../domain/models/${entity.kebab}';\n`
    : ''
}${modelTypes.length > 0 ? `export type { ${modelTypes.join(', ')} } from '../../domain/models/${entity.kebab}';\n` : ''}`;
}

/** `application/contracts/<stem>-views.ts` */
export function viewsTemplate(spec: ModuleSpec): string {
  const { entity, fields } = spec;
  const P = entity.pascal;
  const enumTypes = fields.filter((f) => f.kind === 'enum').map((f) => enumTypeName(P, f));
  const modelImports = [...enumTypes, `${P}ChangesInput`, `${P}DraftInput`].sort();

  return `import type { ${modelImports.join(', ')} } from '../../domain/models/${entity.kebab}';

/** ${/^[aeiou]/.test(entity.kebab) ? 'An' : 'A'} ${words(entity.kebab)} for its owner. The tenant is an internal detail and is not exposed. */
export interface ${P}View {
  readonly id: string;
${fields.map((f) => `  readonly ${f.name}: ${domainType(f, P)};`).join('\n')}
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type Create${P}Input = ${P}DraftInput;

export interface Update${P}Input extends ${P}ChangesInput {
  readonly id: string;
}

export interface Delete${P}Input {
  readonly id: string;
}
`;
}

/** `application/commands/create-<entity>.ts` */
export function createCommandTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const unique = hasUnique(spec);
  const errorTypes = [
    ...(unique ? ['ConflictAppError'] : []),
    'InfrastructureAppError',
    'ValidationAppError',
  ];
  const errorUnion = ['AuthorizationError', ...errorTypes].join(' | ');

  return `import type { AuthorizationError } from '@modules/auth';

import type { ${errorTypes.join(', ')} } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { create${P}Draft } from '../../domain/models/${entity.kebab}';
import { to${P}View } from '../${stem.kebab}-view-mappers';

import type { Create${P}Input, ${P}View } from '../contracts/${stem.kebab}-views';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

/** Creates ${/^[aeiou]/.test(entity.kebab) ? 'an' : 'a'} ${words(entity.kebab)} in the actor's own tenant. */
export class Create${P} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(input: Create${P}Input): AppResultAsync<${P}View, ${errorUnion}> {
    const { authorization, ${entities.camel}, audit } = this.deps;

    return authorization.requireInTenant('${spec.permission}.create').andThen((actor) =>
      create${P}Draft(input)
        .asyncAndThen((draft) => ${entities.camel}.create({ tenantId: actor.tenantId, draft }))
        .map((${entity.camel}) => {
          audit.record({
            type: '${entity.snake}.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            ${entity.camel}Id: ${entity.camel}.id,
          });
          return to${P}View(${entity.camel});
        }),
    );
  }
}
`;
}

/** `application/commands/update-<entity>.ts` */
export function updateCommandTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const c = entity.camel;
  const unique = hasUnique(spec);
  const innerErrors = unique
    ? 'NotFoundAppError | ConflictAppError | InfrastructureAppError'
    : 'NotFoundAppError | InfrastructureAppError';
  const errorTypes = [
    ...(unique ? ['ConflictAppError'] : []),
    'InfrastructureAppError',
    'NotFoundAppError',
  ];

  return `import type { ${errorTypes.join(', ')} } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import { definedKeys } from '@lib/utils';

import { isEmptyChanges, parse${P}Changes } from '../../domain/models/${entity.kebab}';
import { loadAuthorized${P} } from '../load-authorized-${entity.kebab}';
import { to${P}View } from '../${stem.kebab}-view-mappers';

import type { ${P} } from '../../domain/models/${entity.kebab}';
import type { ${P}View, Update${P}Input } from '../contracts/${stem.kebab}-views';
import type { Load${P}Error } from '../load-authorized-${entity.kebab}';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

/** Applies a partial update to one ${words(entity.kebab)}; an empty update changes nothing. */
export class Update${P} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(input: Update${P}Input): AppResultAsync<${P}View, Load${P}Error${unique ? ' | ConflictAppError' : ''}> {
    const { ${entities.camel}, audit } = this.deps;

    return loadAuthorized${P}(this.deps, input.id, '${spec.permission}.update').andThen(
      ({ actor, ${c} }) =>
        parse${P}Changes(input)
          .asyncAndThen((changes): AppResultAsync<${P}, ${innerErrors}> => {
            if (isEmptyChanges(changes)) {
              return okAsync(${c});
            }
            return ${entities.camel}.update(${c}.id, actor.tenantId, changes).map((updated) => {
              audit.record({
                type: '${entity.snake}.updated',
                actorId: actor.id,
                tenantId: actor.tenantId,
                ${c}Id: updated.id,
                changedFields: definedKeys(changes),
              });
              return updated;
            });
          })
          .map(to${P}View),
    );
  }
}
`;
}

/** `application/commands/delete-<entity>.ts` */
export function deleteCommandTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const c = entity.camel;
  return `import type { AppResultAsync } from '@lib/result';

import { loadAuthorized${P} } from '../load-authorized-${entity.kebab}';

import type { Delete${P}Input } from '../contracts/${stem.kebab}-views';
import type { Load${P}Error } from '../load-authorized-${entity.kebab}';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

/** Deletes one ${words(entity.kebab)}. Deleting one that is already gone is a "not found", not a silent success. */
export class Delete${P} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(input: Delete${P}Input): AppResultAsync<void, Load${P}Error> {
    const { ${entities.camel}, audit } = this.deps;

    return loadAuthorized${P}(this.deps, input.id, '${spec.permission}.delete').andThen(
      ({ actor, ${c} }) =>
        ${entities.camel}.deleteById(${c}.id, actor.tenantId).map(() => {
          audit.record({
            type: '${entity.snake}.deleted',
            actorId: actor.id,
            tenantId: actor.tenantId,
            ${c}Id: ${c}.id,
          });
        }),
    );
  }
}
`;
}

/** `application/queries/get-<entity>-by-id.ts` */
export function getQueryTemplate(spec: ModuleSpec): string {
  const { stem, entity } = spec;
  const P = entity.pascal;
  return `import type { AppResultAsync } from '@lib/result';

import { loadAuthorized${P} } from '../load-authorized-${entity.kebab}';
import { to${P}View } from '../${stem.kebab}-view-mappers';

import type { ${P}View } from '../contracts/${stem.kebab}-views';
import type { Load${P}Error } from '../load-authorized-${entity.kebab}';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

/** Reads one ${words(entity.kebab)} of the actor's own tenant. */
export class Get${P}ById {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(id: string): AppResultAsync<${P}View, Load${P}Error> {
    return loadAuthorized${P}(this.deps, id, '${spec.permission}.read').map(({ ${entity.camel} }) =>
      to${P}View(${entity.camel}),
    );
  }
}
`;
}

/** `application/queries/list-<entities>.ts` */
export function listQueryTemplate(spec: ModuleSpec): string {
  const { stem, entity, entities } = spec;
  const P = entity.pascal;
  const E = entity.upperSnake;
  return `import type { AuthorizationError } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp, isDefined } from '@lib/utils';

import {
  DEFAULT_${E}_LIST_LIMIT,
  MAX_${E}_LIST_LIMIT,
  MIN_${E}_LIST_LIMIT,
} from '../${stem.kebab}-limits';
import { to${P}View } from '../${stem.kebab}-view-mappers';

import type { ${P}View } from '../contracts/${stem.kebab}-views';
import type { ${stem.pascal}Dependencies } from '../${stem.kebab}-dependencies';

export interface List${entities.pascal}Options {
  readonly limit?: number;
}

/** Lists the actor's own tenant, most recently changed first. Always bounded. */
export class List${entities.pascal} {
  constructor(private readonly deps: ${stem.pascal}Dependencies) {}

  execute(
    options: List${entities.pascal}Options = {},
  ): AppResultAsync<readonly ${P}View[], AuthorizationError | InfrastructureAppError> {
    const requested =
      isDefined(options.limit) && Number.isInteger(options.limit)
        ? options.limit
        : DEFAULT_${E}_LIST_LIMIT;
    const limit = clamp(requested, MIN_${E}_LIST_LIMIT, MAX_${E}_LIST_LIMIT);

    return this.deps.authorization
      .requireInTenant('${spec.permission}.read')
      .andThen((actor) => this.deps.${entities.camel}.listByTenant(actor.tenantId, limit))
      .map((${entities.camel}) => ${entities.camel}.map(to${P}View));
  }
}
`;
}
