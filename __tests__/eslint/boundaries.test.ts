import { invalid, ruleTester, rules, valid } from './rule-tester';

const DOMAIN = 'src/modules/shop/domain/models/order.ts';
const APP = 'src/modules/shop/application/commands/place-order.ts';
const INFRA_REPO = 'src/modules/shop/infrastructure/prisma/prisma-order.repository.ts';
const INFRA_ADAPTER = 'src/modules/shop/infrastructure/provisioner/stock-provisioner.ts';
const ACTION = 'src/modules/shop/presentation/actions/place-order-action.ts';
const COMPONENT = 'src/modules/shop/presentation/components/order-form.tsx';

ruleTester.run('architecture/layer-imports', rules['layer-imports']!, {
  valid: [
    // domain: shared errors/result/utils, own domain, type-only public API of another module
    valid(
      DOMAIN,
      "import { err } from '@lib/result';\nimport { notFoundError } from '@lib/errors';\nimport { clamp } from '@lib/utils';",
    ),
    valid(DOMAIN, "import { toOrderId } from './ids';"),
    valid(DOMAIN, "import type { TenantId } from '@modules/auth';"),
    valid(DOMAIN, "import type { TenantId } from '@/modules/auth';"),
    // application: domain + application only; types from other modules
    valid(
      APP,
      "import { createOrder } from '../../domain/models/order';\nimport type { Dependencies } from '../shop-dependencies';",
    ),
    valid(APP, "import type { AuthorizationError } from '@modules/auth';"),
    // infrastructure: domain, application, own infra, logger/db/config; cross-module adapter outside prisma/
    valid(
      INFRA_REPO,
      "import { db, createPersistenceFailures } from '@lib/db';\nimport type { TenantId } from '@modules/auth';",
    ),
    valid(INFRA_REPO, "import { toTenantId } from '@modules/auth';"),
    // presentation: another module's browser-safe API, or its types
    valid(COMPONENT, "import { lessonRoutes } from '@modules/lessons/client';"),
    valid(COMPONENT, "import type { MapSectionProps } from '@modules/map';"),
    // the shared Clock port, as a type
    valid(APP, "import type { Clock } from '@lib/clock';"),
    valid(INFRA_REPO, "import type { Clock } from '@lib/clock';"),
    // the shared rate-limiter port and its policy type, as types
    valid(APP, "import type { RateLimiter, RateLimitPolicy } from '@lib/rate-limit';"),
    valid(DOMAIN, "import type { RateLimitFailure } from '@lib/rate-limit';"),
    valid(INFRA_ADAPTER, "import { createLesson } from '@modules/lessons';"),
    // presentation: contracts, composition from actions, shared UI, wrappers
    valid(
      ACTION,
      "import { shopCommands } from '../../composition';\nimport type { OrderView } from '../../application/contracts/order-views';",
    ),
    valid(
      COMPONENT,
      "import { Button } from '@components/ui/button';\nimport { useTranslations } from '@i18n/client';\nimport type { OrderView } from '../../application/contracts/order-views';",
    ),
    // composition root and public API
    valid(
      'src/modules/shop/composition.ts',
      "import 'server-only';\nimport { PrismaOrderRepository } from './infrastructure/prisma/prisma-order.repository';\nimport { PlaceOrder } from './application/commands/place-order';",
    ),
    valid(
      'src/modules/shop/index.ts',
      "export { shopQueries } from './composition';\nexport { OrderForm } from './presentation/components/order-form';\nexport type { OrderView } from './application/contracts/order-views';",
    ),
    // Server Components read through composition; a Client Component cannot (see the invalid cases)
    valid(COMPONENT, "import { shopQueries } from '../../composition';"),
    valid(
      'src/modules/shop/client.ts',
      "export { OrderForm } from './presentation/components/order-form';\nexport type { OrderView } from './application/contracts/order-views';",
    ),
    // framework + shared code
    valid(
      'src/app/page.tsx',
      "import { shopQueries } from '@modules/shop';\nimport { Button } from '@components/ui/button';",
    ),
    valid('src/i18n/locales/en.ts', "import { enLessons } from '@modules/lessons';"),
    valid('src/components/ui/button.tsx', "import { cn } from '@lib/utils';"),
    // a client component importing only client-safe things
    valid(
      COMPONENT,
      "'use client';\nimport { placeOrderAction } from '../actions/place-order-action';",
    ),
  ],
  invalid: [
    invalid(DOMAIN, "import { db } from '@lib/db';", /Domain must not import '@lib\/db'/),
    // a module's server-side parts reach another module's presentation only through composition.ts
    invalid(
      COMPONENT,
      "import { MapSection } from '@modules/map';",
      /Presentation may use another module only through its browser-safe API/,
    ),
    // @lib/clock defines the shared Clock port: the type is everyone's, the system clock is composition's.
    invalid(
      APP,
      "import { systemClock } from '@lib/clock';",
      /may only `import type` from '@lib\/clock'/,
    ),
    // @lib/rate-limit defines the shared RateLimiter port: the type is everyone's, the limiter is composition's.
    invalid(
      APP,
      "import { getRateLimiter } from '@lib/rate-limit';",
      /may only `import type` from '@lib\/rate-limit'/,
    ),
    invalid(DOMAIN, "import { logger } from '@lib/logger';", /must not import '@lib\/logger'/),
    invalid(DOMAIN, "import { useState } from 'react';", /Domain must not depend on 'react'/),
    invalid(DOMAIN, "import Link from 'next/link';", /Domain must not depend on 'next\/link'/),
    invalid(
      DOMAIN,
      "import { PrismaClient } from '@prisma/orm-postgres';",
      /Prisma is an implementation detail/,
    ),
    invalid(
      DOMAIN,
      "import { PlaceOrder } from '../../application/commands/place-order';",
      /Domain must not import application/,
    ),
    invalid(
      DOMAIN,
      "import { shopCommands } from '../../composition';",
      /must not import the module's composition root/,
    ),
    invalid(
      DOMAIN,
      "import { toTenantId } from '@modules/auth';",
      /may only `import type` from another module's public API/,
    ),
    invalid(DOMAIN, "export { toTenantId } from '@modules/auth';", /may only `import type`/),
    invalid(DOMAIN, "export { db } from '@lib/db';", /must not import '@lib\/db'/),
    invalid(APP, "import { db } from '@lib/db';", /Application must not import '@lib\/db'/),
    invalid(
      APP,
      "import { PrismaOrderRepository } from '../../infrastructure/prisma/prisma-order.repository';",
      /Application must not import infrastructure/,
    ),
    invalid(
      APP,
      "import { OrderForm } from '../../presentation/components/order-form';",
      /Application must not import presentation/,
    ),
    invalid(
      APP,
      "import { toTenantId } from '@modules/auth';",
      /Runtime calls into 'auth' belong in an infrastructure adapter/,
    ),
    invalid(
      APP,
      "const lazy = import('../../infrastructure/prisma/prisma-order.repository');",
      /Application must not import infrastructure/,
    ),
    invalid(
      APP,
      "type Repo = import('../../infrastructure/prisma/prisma-order.repository').PrismaOrderRepository;",
      /Application must not import infrastructure/,
    ),
    invalid(APP, "import { Button } from '@components/ui/button';", /must not import shared UI/),
    invalid(
      INFRA_REPO,
      "import { OrderForm } from '../../presentation/components/order-form';",
      /Infrastructure must not import presentation/,
    ),
    invalid(
      INFRA_REPO,
      "import { audit } from '@modules/auth';",
      /Repositories and record mappers must not call another module/,
    ),
    invalid(
      INFRA_REPO,
      "import { PrismaClient } from '@prisma/orm-postgres';",
      /Prisma is an implementation detail/,
    ),
    invalid(
      INFRA_ADAPTER,
      "import { useTranslations } from '@i18n/client';",
      /Infrastructure must not import '@i18n'/,
    ),
    invalid(
      ACTION,
      "import { PrismaOrderRepository } from '../../infrastructure/prisma/prisma-order.repository';",
      /Presentation must not import infrastructure/,
    ),
    invalid(
      ACTION,
      "import { PlaceOrder } from '../../application/commands/place-order';",
      /may only import application\/contracts/,
    ),
    invalid(
      ACTION,
      "import { createOrder } from '../../domain/models/order';",
      /Presentation must not import domain.*constraints/,
    ),
    invalid(
      'src/modules/shop/presentation/dto/order-dto.ts',
      "import { shopQueries } from '../../composition';",
      /must not import the module's composition root/,
    ),
    invalid(COMPONENT, "import { db } from '@lib/db';", /Presentation must not import '@lib\/db'/),
    invalid(
      'src/modules/shop/application/x.ts',
      "import { shopApi } from '../index';",
      /must not import the module's own public API/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { PrismaOrderRepository } from './infrastructure/prisma/prisma-order.repository';",
      /must not be part of the module's public API/,
    ),
    invalid(
      'src/modules/shop/index.ts',
      "export { createOrder } from './domain/models/order';",
      /must not be part of the module's public API/,
    ),
    invalid(
      'src/modules/auth/index.ts',
      "export { getAccessControl } from './infrastructure/access-control';",
      /must not be part of the module's public API/,
    ),
    // client.ts is the browser-safe entry: nothing that reaches the server
    invalid(
      'src/modules/shop/client.ts',
      "export { shopQueries } from './composition';",
      /must not be part of the module's browser-safe API/,
    ),
    invalid(
      'src/modules/shop/client.ts',
      "export { PlaceOrder } from './application/commands/place-order';",
      /must not be part of the module's browser-safe API/,
    ),
    invalid(
      COMPONENT,
      "'use client';\nimport 'server-only';",
      /Client Components must not import server-only code/,
    ),
    invalid(
      COMPONENT,
      "'use client';\nimport { cookies } from 'next/headers';",
      /Client Components must not import server-only code/,
    ),
    invalid(
      'src/lib/seo/x.ts',
      "import { mediaRoutes } from '@modules/media';",
      /Shared code \(lib\/\) must not depend on business modules/,
    ),
    invalid(
      'src/components/ui/x.tsx',
      "import { mediaRoutes } from '@modules/media';",
      /Shared code \(components\/\)/,
    ),
    invalid(
      'src/hooks/use-x.ts',
      "import { x } from '../app/page';",
      /hooks\/ must not import from src\/app/,
    ),
    invalid(
      'src/app/page.tsx',
      "import { PrismaClient } from '@prisma/orm-postgres';",
      /Prisma is an implementation detail/,
    ),
  ],
});

ruleTester.run(
  'architecture/no-cross-module-deep-imports',
  rules['no-cross-module-deep-imports']!,
  {
    valid: [
      valid(APP, "import type { Actor } from '@modules/auth';"),
      valid(APP, "import { x } from '../../domain/models/order';"),
      valid(APP, "import { x } from '@modules/shop/domain/models/order';"), // own module through the alias
      valid('src/app/page.tsx', "import { shopQueries } from '@modules/shop';"),
      valid('src/lib/seo/x.ts', "import { y } from '@lib/utils/clamp';"),
    ],
    invalid: [
      invalid(
        APP,
        "import { x } from '@modules/auth/domain/models/ids';",
        /Deep import into module 'auth' \('domain\/models\/ids'\)/,
      ),
      invalid(
        APP,
        "import type { Actor } from '@/modules/auth/domain/models/actor';",
        /Deep import into module 'auth'/,
      ),
      invalid(
        APP,
        "import { x } from '../../../auth/domain/models/ids';",
        /Deep import into module 'auth'/,
      ),
      invalid(
        APP,
        "import { x } from '@modules/auth/composition';",
        /Deep import into module 'auth' \('composition'\)/,
      ),
      invalid(
        APP,
        "export { x } from '@modules/auth/infrastructure/access-control';",
        /Deep import into module 'auth'/,
      ),
      invalid(
        APP,
        "const m = import('@modules/auth/application/authorization-service');",
        /Deep import into module 'auth'/,
      ),
      invalid(
        APP,
        "const m = require('@modules/auth/domain/models/ids');",
        /Deep import into module 'auth'/,
      ),
      invalid(
        'src/app/page.tsx',
        "import { x } from '@modules/shop/presentation/components/order-form';",
        /Deep import into module 'shop'/,
      ),
      invalid(
        'src/i18n/locales/en.ts',
        "import x from '@modules/lessons/presentation/i18n/en.json';",
        /Deep import into module 'lessons'/,
      ),
    ],
  },
);

ruleTester.run('architecture/no-i18n-in-core', rules['no-i18n-in-core']!, {
  valid: [
    valid(COMPONENT, "import { useTranslations } from '@i18n/client';"),
    valid(DOMAIN, "import { err } from '@lib/result';"),
    valid(INFRA_REPO, "import { x } from 'next-intl';"), // other layers are not this rule's concern
  ],
  invalid: [
    invalid(
      DOMAIN,
      "import { useTranslations } from 'next-intl';",
      /domain layer must not depend on i18n/,
    ),
    invalid(
      APP,
      "import { getTranslations } from 'next-intl/server';",
      /application layer must not depend on i18n/,
    ),
    invalid(APP, "import { Locale } from '@i18n';", /must not depend on i18n/),
    invalid(
      DOMAIN,
      "import { messageKeyForCode } from '../../presentation/messages/message-keys';",
      /Return a stable error\/validation code/,
    ),
    invalid(APP, "const t = useTranslations('shop');", /Do not translate in the application layer/),
  ],
});

ruleTester.run('architecture/field-error-bag-owner', rules['field-error-bag-owner']!, {
  valid: [
    valid(
      'src/modules/shop/domain/errors/shop-errors.ts',
      'export const createShopErrorBag = () => new FieldErrorBag(fieldValidationFailed);',
    ),
    valid('src/lib/errors/field-error-bag.ts', 'export const make = () => new FieldErrorBag(f);'),
    valid(
      DOMAIN,
      "import type { FieldErrorBag } from '@lib/errors';\nfunction check(bag: FieldErrorBag) { bag.add('a', 'b'); }",
    ),
  ],
  invalid: [
    invalid(
      DOMAIN,
      'const bag = new FieldErrorBag(f);',
      /Construct `FieldErrorBag` only in the module's domain\/errors/,
    ),
    invalid(APP, 'const bag = new FieldErrorBag(f);', /createShopErrorBag|create<Module>ErrorBag/),
    invalid(ACTION, 'const bag = new FieldErrorBag(f);', /domain\/errors/),
  ],
});

ruleTester.run('architecture/no-throw-in-core-layers', rules['no-throw-in-core-layers']!, {
  valid: [
    valid(
      DOMAIN,
      "import { err } from '@lib/result';\nexport const f = () => err(shopNotFound());",
    ),
    // containment stays legal: try/catch, and rethrowing the caught binding unchanged
    valid(
      INFRA_REPO,
      'export async function f() { try { await g(); } catch { return undefined; } }',
    ),
    valid(
      INFRA_REPO,
      'export async function f() { try { await g(); } catch (e) { cleanup(); throw e; } }',
    ),
    valid(APP, "export const f = () => err(new Error('as a cause'));"),
    // not core layers
    valid(ACTION, "export function f() { throw new Error('framework boundary'); }"),
    valid('src/lib/utils/x.ts', "export function f() { throw new TypeError('x'); }"),
    // the module root (composition.ts) fails fast on invalid configuration at boot; it is not one of the core layers
    valid(
      'src/modules/auth/composition.ts',
      'export function f(raw: string) { throw new Error(`bad ${raw}`); }',
    ),
    // a `'use cache'` function does not cache a thrown error: the typed failure is thrown through the cache boundary
    valid(APP, "'use cache';\nexport async function f() { throw shopNotFound(); }"),
  ],
  invalid: [
    invalid(
      DOMAIN,
      "export function f() { throw new Error('nope'); }",
      /Do not `throw` in the domain layer/,
    ),
    invalid(
      APP,
      'export function f() { throw shopNotFound(); }',
      /Do not `throw` in the application layer.*AppResult/,
    ),
    invalid(
      INFRA_REPO,
      "export function f() { throw new Error('db'); }",
      /Do not `throw` in the infrastructure layer/,
    ),
    invalid(
      INFRA_REPO,
      "export async function f() { try { await g(); } catch (e) { throw new Error('wrapped'); } }",
      /Do not `throw`/,
    ),
    invalid(
      DOMAIN,
      'export class ShopError extends Error {}',
      /Do not define Error subclasses in the domain layer/,
    ),
    invalid(
      'src/modules/auth/infrastructure/dev/x.ts',
      "export function f() { throw new Error('x'); }",
      /Do not `throw` in the infrastructure layer/,
    ),
    invalid(
      'src/modules/shop/infrastructure/access-control.ts',
      "export function f() { throw new Error('x'); }",
      /Do not `throw`/,
    ), // the exemption belongs to auth's policy, not to a file name
  ],
});

const SERVER_ACTION = 'src/modules/shops/presentation/actions/create-shop-action.ts';

ruleTester.run('architecture/directive-placement', rules['directive-placement']!, {
  valid: [
    valid(SERVER_ACTION, "'use server';\nexport async function createShopAction() { return 1; }"),
    valid(
      'src/modules/shops/presentation/components/shop-form.tsx',
      "'use client';\nexport function ShopForm() { return null; }",
    ),
    // error boundaries must be Client Components
    valid(
      'src/app/[locale]/error.tsx',
      "'use client';\nexport default function Error() { return null; }",
    ),
    valid('src/app/[locale]/shops/page.tsx', 'export default function Page() { return null; }'),
  ],
  invalid: [
    invalid(
      'src/modules/shops/presentation/components/shop-form.tsx',
      "'use server';\nexport async function save() { return 1; }",
      /public endpoint/,
    ),
    invalid(
      'src/modules/shops/presentation/components/shop-form.tsx',
      "export function ShopForm() { async function save() { 'use server'; } return null; }",
      /public endpoint/,
    ),
    invalid(
      'src/app/[locale]/shops/page.tsx',
      "'use client';\nexport default function Page() { return null; }",
      /stay Server Components/,
    ),
    invalid(
      'src/modules/shops/application/commands/create-shop.ts',
      "'use client';\nexport class CreateShop {}",
      /never runs in the browser/,
    ),
  ],
});
