import { invalid, ruleTester, rules, valid } from './rule-tester';

const COMMAND = 'src/modules/shop/application/commands/create-shop.ts';
const QUERY = 'src/modules/shop/application/queries/get-shop-by-id.ts';
const LIST_QUERY = 'src/modules/shop/application/queries/list-shops.ts';
const DEPS_FILE = 'src/modules/shop/application/shop-dependencies.ts';
const HELPER = 'src/modules/shop/application/load-authorized-shop.ts';

const GOOD_COMMAND = `
import type { AuthorizationError } from '@modules/auth';
import type { AppResultAsync } from '@lib/result';
import type { ShopDependencies } from '../shop-dependencies';
export type CreateShopError = AuthorizationError | InfrastructureAppError;
export class CreateShop {
  constructor(private readonly deps: ShopDependencies) {}
  execute(input: Input): AppResultAsync<View, CreateShopError> {
    const { authorization, audit } = this.deps;
    return authorization.requireInTenant('shop.create').andThen((actor) => {
      audit.record({ type: 'shop.created', actorId: actor.id });
      return okAsync(view);
    });
  }
  private helper(): void {}
}`;

ruleTester.run('architecture/command-query-shape', rules['command-query-shape']!, {
  valid: [
    valid(COMMAND, GOOD_COMMAND),
    valid(
      LIST_QUERY,
      `import type { AppResultAsync } from '@lib/result';
import { SHOP_LIST_LIMITS } from '../shop-limits';
import type { ShopDependencies } from '../shop-dependencies';
export class ListShops {
  constructor(private readonly deps: ShopDependencies) {}
  execute(): AppResultAsync<readonly View[], InfrastructureAppError> { return run(SHOP_LIST_LIMITS.max); }
}`,
    ),
    valid(
      'src/modules/shop/application/queries/get-public-shop-by-slug.ts',
      `import type { PublicShopDependencies } from '../shop-dependencies';
export class GetPublicShopBySlug {
  constructor(private readonly deps: PublicShopDependencies) {}
  execute(slug: string): AppResultAsync<View, NotFoundAppError | InfrastructureAppError> { return x; }
}`,
    ),
    valid('src/modules/shop/application/shop-scope.ts', 'export function scopeOf() {}'), // not a use case
  ],
  invalid: [
    invalid(COMMAND, `${GOOD_COMMAND}\nexport class Other {}`, /exactly one class \(found 2\)/),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('class CreateShop', 'class MakeShop'),
      /Class name must match the file name: 'create-shop.ts' declares `CreateShop`/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('constructor(private readonly deps: ShopDependencies) {}', ''),
      /declares one constructor/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('private readonly deps', 'private deps'),
      /single `private readonly deps/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace(
        "import type { ShopDependencies } from '../shop-dependencies';",
        "import type { ShopDependencies } from './local-deps';",
      ),
      /centralised in application\/<module>-dependencies.ts/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('private helper(): void {}', 'public helper(): void {}'),
      /exactly one public entry point named `execute` \(also public: helper/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('execute(input', 'run(input'),
      /exactly one public entry point named `execute`/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('AppResultAsync<View, CreateShopError>', 'Promise<View>'),
      /declares its return type as AppResultAsync/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace(
        'AppResultAsync<View, CreateShopError>',
        'AppResultAsync<View, unknown>',
      ),
      /Spell out the error union/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('export class', 'export function helper() {}\nexport class'),
      /exports its class \(and types\) only/,
    ),
    invalid(COMMAND, `${GOOD_COMMAND}\nexport default CreateShop;`, /Use a named export/),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('private helper(): void {}', 'readonly cache = new Map();'),
      /Do not expose state/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace(
        'private helper(): void {}',
        'private repo() { return new PrismaShopRepository(); }',
      ),
      /Do not construct `PrismaShopRepository` inside a command/,
    ),
    invalid(
      LIST_QUERY,
      `import type { ShopDependencies } from '../shop-dependencies';
export class ListShops {
  constructor(private readonly deps: ShopDependencies) {}
  execute(): AppResultAsync<readonly View[], InfrastructureAppError> { return x; }
}`,
      /A query that returns a list must be bounded by application\/<module>-limits.ts/,
    ),
  ],
});

ruleTester.run('architecture/command-audit-dependency', rules['command-audit-dependency']!, {
  valid: [
    // a dependency set is judged from the command built on it (`__tests__/architecture`), not as a file of its own
    valid(
      DEPS_FILE,
      'export interface ShopQueryDependencies { readonly authorization: A; readonly shops: R; }',
    ),
    valid(COMMAND, GOOD_COMMAND),
    // having the dependency never forces a command to emit when it documents why not
    valid(
      COMMAND,
      GOOD_COMMAND.replace(
        "audit.record({ type: 'shop.created', actorId: actor.id });",
        '',
      ).replace(
        'export class CreateShop',
        '/** Dry run. @audit-exempt nothing is persisted, so there is nothing to audit. */\nexport class CreateShop',
      ),
    ),
    valid(
      QUERY,
      `export class GetShopById { constructor(private readonly deps: PublicShopDependencies) {} }`,
    ), // queries are never audited
  ],
  invalid: [
    invalid(
      COMMAND,
      GOOD_COMMAND.replace("audit.record({ type: 'shop.created', actorId: actor.id });", ''),
      /never records an audit event/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace('ShopDependencies) {}', 'PublicShopDependencies) {}'),
      /must not be built from the public dependency set `PublicShopDependencies`/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace(
        "audit.record({ type: 'shop.created', actorId: actor.id });",
        'audit.record(event);',
      ),
      /Record a typed audit event/,
    ),
    invalid(
      COMMAND,
      GOOD_COMMAND.replace(
        "audit.record({ type: 'shop.created', actorId: actor.id });",
        'audit.record({ type, actorId: actor.id });',
      ),
      /literal `type`/,
    ),
  ],
});

const PROTECTED_QUERY = (body: string) => `
export class GetShopById {
  constructor(private readonly deps: ShopDependencies) {}
  execute(id: string): AppResultAsync<View, E> {
    ${body}
  }
}`;

ruleTester.run('architecture/authorization-flow', rules['authorization-flow']!, {
  valid: [
    valid(
      QUERY,
      PROTECTED_QUERY(
        "return loadAuthorizedShop(this.deps, id, 'shop.read').map(({ shop }) => toView(shop));",
      ),
    ),
    valid(
      QUERY,
      PROTECTED_QUERY(
        "return this.deps.authorization.requireInTenant('shop.read').andThen(() => this.deps.shops.list());",
      ),
    ),
    valid(COMMAND, GOOD_COMMAND),
    // an intentionally public read may validate before anything else
    valid(
      'src/modules/shop/application/queries/get-public-shop-by-slug.ts',
      `export class GetPublicShopBySlug {
  constructor(private readonly deps: PublicShopDependencies) {}
  execute(slug: string): AppResultAsync<View, E> { if (!ok(slug)) return errAsync(x); return this.deps.shops.findBySlug(slug); }
}`,
    ),
    valid(
      HELPER,
      `export function loadAuthorizedShop(deps: ShopDependencies, rawId: string, permission: Permission) {
  const { authorization, shops } = deps;
  return authorization.requireInTenant(permission).andThen((actor) =>
    parseShopId(rawId)
      .asyncAndThen((id) => shops.findById(id, actor.tenantId))
      .andThen((shop) => (shop === null ? errAsync(shopNotFound()) : okAsync(shop)))
      .andThen((shop) => authorization.requireOnResource(permission, scopeOf(shop)).map((verified) => ({ actor: verified, shop })))
  );
}`,
    ),
    // another module enforces the owner: declared, with a reason, it needs no owner-keyed load and no resource scope
    valid(
      HELPER,
      `/** Resolves the resource through its module. @owner-scope delegated the parent module resolves it inside the actor's scope */
export function loadAuthorizedShop(deps: ShopDependencies, rawId: string, permission: Permission) {
  return deps.authorization.requireInTenant(permission).andThen((actor) =>
    parseShopId(rawId)
      .asyncAndThen((id) => deps.shops.findById(id))
      .andThen((shop) => (shop === null ? errAsync(shopNotFound()) : okAsync(shop)))
      .map((shop) => ({ actor, shop })));
}`,
    ),
  ],
  invalid: [
    invalid(
      HELPER,
      `/** @owner-scope delegated the parent module enforces it */
export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return parseShopId(rawId).asyncAndThen((id) => deps.shops.findById(id));
}`,
      /declared `@owner-scope delegated` but still needs: requireInTenant, <resource>NotFound/,
    ),
    // the tag needs a reason; without one the standard sequence applies
    invalid(
      HELPER,
      `/** @owner-scope delegated */
export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return deps.authorization.requireInTenant(permission).andThen(() => parseShopId(rawId).asyncAndThen((id) => deps.shops.findById(id)));
}`,
      /Missing: load by \(id, actor\.tenantId\), <resource>NotFound, requireOnResource/,
    ),
    invalid(
      QUERY,
      PROTECTED_QUERY('return errAsync(validationFailed());'),
      /must authorize before anything else/,
    ),
    invalid(
      QUERY,
      PROTECTED_QUERY(
        "if (id === '') { return errAsync(x); }\n return loadAuthorizedShop(this.deps, id, 'p');",
      ),
      /must authorize before anything else/,
    ),
    invalid(
      QUERY,
      PROTECTED_QUERY('return this.deps.shops.findById(id);'),
      /must authorize before anything else/,
    ),
    invalid(
      QUERY,
      PROTECTED_QUERY("return this.deps.authorization.requireOnResource('p', { tenantId: id });"),
      /must authorize before anything else/,
      /Do not authorize a resource inside a use case/,
    ),
    invalid(
      QUERY,
      PROTECTED_QUERY("const s = scopeOf(x);\n return loadAuthorizedShop(this.deps, id, 'p');"),
      /Derive scope inside `loadAuthorized<Resource>`/,
    ),
    invalid(
      HELPER,
      `export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return deps.authorization.requireInTenant(permission).andThen((actor) =>
    parseShopId(rawId).asyncAndThen((id) => deps.shops.findById(id, actor.tenantId)));
}`,
      /Missing: <resource>NotFound, requireOnResource/,
    ),
    invalid(
      HELPER,
      `export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return deps.authorization.requireInTenant(permission).andThen((actor) =>
    parseShopId(rawId)
      .asyncAndThen((id) => deps.shops.findById(id, rawId))
      .andThen((shop) => (shop === null ? errAsync(shopNotFound()) : okAsync(shop)))
      .andThen((shop) => deps.authorization.requireOnResource(permission, scopeOf(shop))));
}`,
      /Missing: load by \(id, actor\.tenantId\)/,
    ),
    invalid(
      HELPER,
      `export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return deps.authorization.requireInTenant(permission).andThen((actor) =>
    parseShopId(rawId)
      .asyncAndThen((id) => deps.shops.findById(id, actor.tenantId))
      .andThen((shop) => (shop === null ? errAsync(shopNotFound()) : okAsync(shop)))
      .andThen((shop) => deps.authorization.requireOnResource(permission, { tenantId: rawId })));
}`,
      /Pass `scopeOf\(<stored record>\)`/,
    ),
    invalid(
      HELPER,
      `export function loadAuthorizedShop(deps: D, rawId: string, permission: P) {
  return parseShopId(rawId).asyncAndThen((id) => deps.authorization.requireInTenant(permission).andThen((actor) =>
    deps.shops.findById(id, actor.tenantId).andThen((shop) => shopNotFound() && deps.authorization.requireOnResource(permission, scopeOf(shop)))));
}`,
      /calls steps out of order/,
    ),
  ],
});

ruleTester.run('architecture/limits-usage', rules['limits-usage']!, {
  valid: [
    valid(
      'src/modules/shop/application/shop-limits.ts',
      'export const SHOP_LIST_LIMITS = { default: 50, min: 1, max: 100 } as const;',
    ),
    valid(
      QUERY,
      "import { SHOP_LIST_LIMITS } from '../shop-limits';\nconst limit = clamp(requested, SHOP_LIST_LIMITS.min, SHOP_LIST_LIMITS.max);",
    ),
    valid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'const q = base.limit(limit).all();',
    ),
    valid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'const first = base.limit(1);',
    ), // 0/1 are existence checks, not list bounds
    valid(QUERY, 'const RETRY_DELAY_MS = 500;\nconst timeout = { retries: 3 };'), // numbers that are not limits
    valid('src/modules/shop/domain/models/shop.ts', 'export const SHOP_LIMITS = { nameMax: 120 };'), // field constraints are domain, not query bounds
  ],
  invalid: [
    invalid(
      LIST_QUERY,
      'const DEFAULT_LIST_LIMIT = 50;',
      /Limit constant 'DEFAULT_LIST_LIMIT' must not be declared here\. Define it in application\/<module>-limits.ts/,
    ),
    invalid(LIST_QUERY, 'const MAX_LIST_LIMIT = 100;', /Limit constant 'MAX_LIST_LIMIT'/),
    invalid(LIST_QUERY, 'const PAGE_SIZE = 20;', /Limit constant 'PAGE_SIZE'/),
    invalid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'const rows = base.limit(25).all();',
      /Hard-coded bound passed to \.limit\(\)/,
    ),
    invalid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'const rows = client.take(10);',
      /Hard-coded bound passed to \.take\(\)/,
    ),
    invalid(QUERY, 'const x = clamp(n, 1, 100);', /Clamp bounds are limits/),
    invalid(QUERY, 'const q = { limit: 30 };', /Hard-coded 'limit'/),
    invalid(QUERY, 'function list(pageSize = 25) {}', /Default value for 'pageSize' is a limit/),
  ],
});

ruleTester.run('architecture/branded-id-usage', rules['branded-id-usage']!, {
  valid: [
    valid(
      'src/modules/shop/domain/models/ids.ts',
      `export type ShopId = Brand<string, 'ShopId'>;
export function toShopId(raw: string): ShopId { return raw as ShopId; }
export function parseShopId(raw: string) { return ok(toShopId(raw)); }`,
    ),
    valid(
      'src/modules/shop/domain/ports/shop.repository.ts',
      'export interface ShopRepository { findById(id: ShopId, tenantId: TenantId): R; findBySlug(slug: string): R; }',
    ),
    valid(
      'src/modules/shop/domain/ports/home.port.ts',
      'export interface Input { readonly tenantId: TenantId; readonly slug: string; }',
    ),
    valid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'export class R { findById(id: ShopId, tenantId: TenantId) {} }',
    ),
    // persistence records and row sources are raw strings by nature
    valid(
      'src/modules/shop/infrastructure/prisma/shop-record-mapper.ts',
      'export interface ShopRecord { id: string; tenantId: string; }',
    ),
    valid(
      'src/modules/auth/infrastructure/prisma/prisma-membership.repository.ts',
      'export interface RowSource { findRoleNames(actorId: string, tenantId: string): Promise<string[]>; }',
    ),
    valid(
      'src/modules/shop/application/commands/create-shop.ts',
      'const raw = (id: string) => id;',
    ), // request ids are strings until parsed
  ],
  invalid: [
    invalid(
      'src/modules/shop/domain/models/ids.ts',
      "export type ShopId = Brand<string, 'ShopId'>;\nexport function parseShopId(raw: string) {}",
      /needs a trusted constructor `toShopId/,
    ),
    invalid(
      'src/modules/shop/domain/models/ids.ts',
      "export type ShopId = Brand<string, 'ShopId'>;\nexport function toShopId(raw: string): ShopId { return raw as ShopId; }",
      /needs a validating parser `parseShopId/,
    ),
    invalid(
      'src/modules/shop/application/shop-scope.ts',
      'const x = raw as ShopId;',
      /Do not cast to the branded id `ShopId`\. Use `toShopId\(raw\)`.*`parseShopId\(raw\)`/,
    ),
    invalid(
      'src/modules/shop/presentation/actions/x-action.ts',
      'const x = <TenantId>raw;',
      /Do not cast to the branded id `TenantId`/,
    ),
    invalid(
      'src/modules/shop/domain/ports/shop.repository.ts',
      'export interface ShopRepository { findById(id: string, tenantId: TenantId): R; }',
      /`id` is an identifier and crosses a port boundary as plain `string`/,
    ),
    invalid(
      'src/modules/shop/domain/ports/home.port.ts',
      'export interface Input { readonly tenantId: string; }',
      /`tenantId` is an identifier and crosses a port boundary/,
    ),
    invalid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'export class R { findById(id: ShopId, tenantId: string) {} }',
      /`tenantId` .* repository\/adapter boundary as plain `string`/,
    ),
    invalid(
      'src/modules/shop/infrastructure/provisioner/stock-provisioner.ts',
      'export class P { provision(childId: string) {} }',
      /`childId` .* boundary as plain `string`/,
    ),
  ],
});

const PUBLIC_QUERY = 'src/modules/shop/application/queries/get-public-shop.ts';
const POLICIES = 'src/modules/shop/application/rate-limits.ts';

const POLICIES_FILE = `
import { SECONDS_PER_MINUTE } from '@lib/utils';
import type { RateLimitPolicy } from '@lib/rate-limit';

export const SHOP_RATE_LIMITS = {
  lookup: { id: 'shop.lookup', limit: 10, windowSeconds: SECONDS_PER_MINUTE, onBackendFailure: 'deny' },
} as const satisfies Record<string, RateLimitPolicy>;`;

const publicUseCase = (comment: string, body: string) => `
import type { AppResultAsync } from '@lib/result';
import { SHOP_RATE_LIMITS } from '../rate-limits';
/**
${comment}
 */
export class GetPublicShop {
  constructor(private readonly deps: PublicShopDependencies) {}
  execute(): AppResultAsync<View, Error> { ${body} }
}`;

ruleTester.run('architecture/rate-limit-usage', rules['rate-limit-usage']!, {
  valid: [
    valid(
      PUBLIC_QUERY,
      publicUseCase(
        ' * @authorization public Anyone may look a shop up.',
        'return limit(this.deps, SHOP_RATE_LIMITS.lookup);',
      ),
    ),
    valid(
      PUBLIC_QUERY,
      publicUseCase(
        ' * @authorization public Anyone may read the catalog.\n * @rate-limit none Cached content; a budget would make every page dynamic.',
        'return read();',
      ),
    ),
    // A protected use case may spend a budget (after authorizing) or not: it is a judgment, not a rule.
    valid(COMMAND, `${GOOD_COMMAND}\nconst budget = SHOP_RATE_LIMITS.create;`),
    valid(
      'src/modules/shop/application/services/limit-visitor.ts',
      'export const f = (deps: D) => deps.rateLimiter.enforce({ policy, subject });',
    ),
    valid(POLICIES, POLICIES_FILE),
    valid(
      'src/modules/shop/composition.ts',
      "import { getRateLimiter } from '@lib/rate-limit'; const rateLimiter = getRateLimiter();",
    ),
  ],
  invalid: [
    invalid(
      PUBLIC_QUERY,
      publicUseCase(' * @authorization public Anyone may look a shop up.', 'return read();'),
      /A public use case runs for anyone, so it spends a budget declared in application\/rate-limits\.ts.*@rate-limit none <reason>/,
    ),
    invalid(
      PUBLIC_QUERY,
      publicUseCase(
        ' * @authorization public Anyone may look a shop up.\n * @rate-limit none',
        'return read();',
      ),
      /Write the opt-out as `@rate-limit none <reason>`/,
    ),
    invalid(
      PUBLIC_QUERY,
      publicUseCase(
        ' * @authorization public Anyone may look a shop up.\n * @rate-limit none Cached content and statically evaluated.',
        'return limit(this.deps, SHOP_RATE_LIMITS.lookup);',
      ),
      /tagged `@rate-limit none` but spends a budget/,
    ),
    invalid(
      'src/modules/shop/application/services/limit-visitor.ts',
      "export const f = (deps: D) => deps.rateLimiter.enforce({ policy: { id: 'shop.x', limit: 1 }, subject });",
      /Pass a policy declared in application\/rate-limits\.ts, not an inline object/,
    ),
    invalid(
      'src/modules/shop/application/services/limit-visitor.ts',
      "export const f = (deps: D) => deps.rateLimiter.enforceAll([{ policy: { id: 'shop.x' }, subject }]);",
      /Pass a policy declared in application\/rate-limits\.ts/,
    ),
    invalid(
      'src/modules/shop/presentation/actions/find-shop-action.ts',
      "'use server'; export async function findShopAction() { return rateLimiter.enforce({ policy, subject }); }",
      /Only a use case \(application layer\) may call the rate limiter/,
    ),
    invalid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'export class R { find() { return this.rateLimiter.enforceAll(requests); } }',
      /Only a use case \(application layer\) may call the rate limiter/,
    ),
    invalid(
      POLICIES,
      `import { z } from 'zod';\n${POLICIES_FILE}`,
      /plain data: it may import only @lib\/utils and @lib\/rate-limit, not 'zod'/,
    ),
    invalid(
      POLICIES,
      POLICIES_FILE.replace('import type { RateLimitPolicy }', 'import { RateLimitPolicy }'),
      /Import the policy type with `import type`/,
    ),
    invalid(
      POLICIES,
      POLICIES_FILE.replace('SHOP_RATE_LIMITS', 'shopPolicies'),
      /Name the export `<NAME>_RATE_LIMITS`/,
    ),
    invalid(
      POLICIES,
      POLICIES_FILE.replace('as const satisfies Record<string, RateLimitPolicy>', 'as const'),
      /End the declaration with `satisfies Record<string, RateLimitPolicy>`/,
    ),
    invalid(
      POLICIES,
      POLICIES_FILE.replace("id: 'shop.lookup'", 'id: LOOKUP_ID'),
      /Give every policy a literal string `id`/,
    ),
    invalid(
      POLICIES,
      `${POLICIES_FILE}\nexport function lookupPolicy() {}`,
      /exports policy data only/,
    ),
  ],
});
