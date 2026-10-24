import { invalid, ruleTester, rules, valid } from './rule-tester';

const ok = (path: string) => valid(path, 'export const x = 1;');
const bad = (path: string, pattern: RegExp) => invalid(path, 'export const x = 1;', pattern);

ruleTester.run('architecture/module-structure', rules['module-structure']!, {
  valid: [
    // the standard layout, for a module that is NOT listed anywhere in the policy
    ...[
      'index.ts',
      'client.ts',
      'composition.ts',
      'domain/errors/shop-errors.ts',
      'domain/models/shop.ts',
      'domain/models/ids.ts',
      'domain/ports/shop.repository.ts',
      'domain/ports/shop-audit-log.port.ts',
      'application/shop-dependencies.ts',
      'application/shop-limits.ts',
      'application/shop-scope.ts',
      'application/shop-view-mappers.ts',
      'application/load-authorized-shop.ts',
      'application/commands/create-shop.ts',
      'application/queries/list-shops.ts',
      'application/contracts/shop-views.ts',
      'application/contracts/shop-constraints.ts',
      'application/contracts/shop-inputs.ts',
      'application/contracts/shop-model.ts',
      'application/contracts/shop-snapshot.ts',
      'application/contracts/cache-tags.ts',
      'application/services/enforce-rate-limit.ts',
      'infrastructure/prisma/prisma-shop.repository.ts',
      'infrastructure/prisma/shop-record-mapper.ts',
      'infrastructure/prisma/tenant-ownership.ts',
      'infrastructure/audit/logger-shop-audit-log.ts',
      'infrastructure/provisioner/stock-provisioner.ts',
      'presentation/routes.ts',
      'presentation/actions/create-shop-action.ts',
      'presentation/dto/shop-dto.ts',
      'presentation/schemas/new-shop-schema.ts',
      'presentation/schemas/parse-shop-input.ts',
      'presentation/messages/message-keys.ts',
      'presentation/i18n/catalog.ts',
      'presentation/components/shop-card.tsx',
      'presentation/components/ui/button.tsx',
      'presentation/components/layout/page-shell.tsx',
      'presentation/guards/require-signed-in.ts',
      // open layers: a folder named for what it holds is fine (hooks, state, dnd, discovery, templates, theme …)
      'domain/templates/template-registry.ts',
      'domain/discovery/discovery.ts',
      'infrastructure/better-auth/create-auth.ts',
      'presentation/hooks/use-shop-selection.ts',
      'presentation/theme/theme-to-css.ts',
    ].map((p) => ok(`src/modules/shop/${p}`)),
    // not module code
    ok('src/lib/utils/x.ts'),
  ],
  invalid: [
    // generic names say nothing about their content and are rejected wherever they appear
    bad('src/modules/shop/utils.ts', /'utils\.ts' says nothing about its content/),
    bad('src/modules/shop/helpers/x.ts', /'helpers' is not a layer folder/),
    bad('src/modules/shop/domain/helpers.ts', /'helpers\.ts' says nothing about its content/),
    bad('src/modules/shop/domain/utils/x.ts', /'domain\/utils\/' is not a valid folder name/),
    bad(
      'src/modules/shop/domain/Templates/x.ts',
      /'domain\/Templates\/' is not a valid folder name/,
    ),
    bad('src/modules/shop/domain/registry.ts', /'registry\.ts' cannot sit directly in domain\//),
    bad(
      'src/modules/shop/infrastructure/access-control.ts',
      /cannot sit directly in infrastructure\//,
    ),
    bad(
      'src/modules/shop/presentation/return-path.ts',
      /cannot sit directly in presentation\/\. Allowed here: routes\.ts/,
    ),
    bad(
      'src/modules/shop/domain/errors/shop-error.ts',
      /does not follow the domain\/errors\/ naming convention/,
    ),
    bad(
      'src/modules/shop/domain/ports/shop.ts',
      /does not follow the domain\/ports\/ naming convention/,
    ),
    bad('src/modules/shop/application/helpers.ts', /says nothing about its content/),
    bad(
      'src/modules/shop/application/enforce-rate-limit.ts',
      /cannot sit directly in application\/\. Allowed here:/,
    ),
    // a module without a manifest exception gets no extra root files
    bad(
      'src/modules/shop/application/authorization-service.ts',
      /cannot sit directly in application\//,
    ),
    bad(
      'src/modules/shop/application/contracts/shop.ts',
      /application\/contracts\/ naming convention/,
    ),
    bad(
      'src/modules/shop/infrastructure/misc/x.ts',
      /'infrastructure\/misc\/' is not a valid folder name/,
    ),
    bad(
      'src/modules/shop/application/extras/x.ts',
      /'application\/extras\/' is not an approved folder/,
    ), // application is a closed layer
    bad(
      'src/modules/shop/infrastructure/prisma/shop.ts',
      /infrastructure\/prisma\/ naming convention/,
    ),
    bad(
      'src/modules/shop/presentation/actions/shop.ts',
      /presentation\/actions\/ naming convention.*-action\.ts/,
    ),
    bad('src/modules/shop/presentation/dto/shop.ts', /presentation\/dto\/ naming convention/),
    bad(
      'src/modules/shop/presentation/messages/keys.ts',
      /presentation\/messages\/ naming convention/,
    ),
    bad(
      'src/modules/shop/presentation/schemas/shop.ts',
      /presentation\/schemas\/ naming convention/,
    ),
    bad(
      'src/modules/shop/presentation/actions/nested/create-shop-action.ts',
      /presentation\/actions\/ is flat/,
    ),
  ],
});

ruleTester.run('architecture/module-public-api', rules['module-public-api']!, {
  valid: [
    valid(
      'src/modules/shop/index.ts',
      `export { shopQueries } from './composition';
export { OrderForm } from './presentation/components/order-form';
export { shopRoutes } from './presentation/routes';
export type { ShopView } from './application/contracts/shop-views';
export type { ShopRepository } from './domain/ports/shop.repository';`,
    ),
    valid('src/modules/shop/domain/models/shop.ts', 'export * from "./x";'), // only index.ts is a public API
  ],
  invalid: [
    invalid(
      'src/modules/shop/index.ts',
      "export * from './presentation/routes';",
      /Avoid `export \*` in a module public API/,
    ),
    invalid('src/modules/shop/index.ts', 'export default {};', /named exports/),
    invalid(
      'src/modules/shop/index.ts',
      "export { PrismaShopRepository } from './composition';",
      /`PrismaShopRepository` looks like an implementation detail/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { ShopRepository } from './composition';",
      /looks like an implementation detail/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { shopRecordMapper } from './composition';",
      /Mapper|implementation detail/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { createShopErrorBag } from './composition';",
      /error factory/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { LoggerShopAuditLog } from './composition';",
      /implementation detail/,
    ),
    invalid('src/modules/shop/index.ts', 'export const x = 1;', /index\.ts only re-exports/),
  ],
});
