import { invalid, ruleTester, rules, valid } from './rule-tester';

const REPO = 'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts';
const MAPPER = 'src/modules/shop/infrastructure/prisma/shop-record-mapper.ts';
const AUDIT = 'src/modules/shop/infrastructure/audit/logger-shop-audit-log.ts';

const GOOD_REPO = `
import { createPersistenceFailures, db } from '@lib/db';
import { fromThrowableAsync } from '@lib/result';
const failures = createPersistenceFailures({ module: 'shop.persistence', code: 'shop.failed', subject: 'Shop' });
function query() { return db.orm.public.Shop.select('id'); }
export class PrismaShopRepository {
  findById(id: ShopId, tenantId: TenantId) {
    return fromThrowableAsync(() => query().where({ id, tenantId }).first(), failures.infraOnly('findById')).map(toShop);
  }
  create(input: NewShop) {
    return fromThrowableAsync(
      () => db.transaction(async (tx) => tx.orm.public.Shop.create(input)),
      failures.orConflict('create', shopSlugTaken)
    ).map(toShop);
  }
  update(id: ShopId) {
    return fromThrowableAsync(() => db.orm.public.Shop.where({ id }).update({}), failures.infraOnly('update'));
  }
}`;

ruleTester.run('architecture/persistence-failures', rules['persistence-failures']!, {
  valid: [
    valid(REPO, GOOD_REPO),
    valid(
      MAPPER,
      "import type { ShopRecord } from './types';\nexport function toShop(record: ShopRecord) { return record; }",
    ),
  ],
  invalid: [
    invalid(
      REPO,
      GOOD_REPO.replace(
        "const failures = createPersistenceFailures({ module: 'shop.persistence', code: 'shop.failed', subject: 'Shop' });",
        '',
      ),
      /must create its failure mapper/,
    ),
    invalid(
      REPO,
      GOOD_REPO.replace("failures.infraOnly('findById')", '(e) => toInfra(e)'),
      /Pass `failures\.infraOnly/,
    ),
    invalid(
      REPO,
      GOOD_REPO.replace(
        'findById(id: ShopId, tenantId: TenantId) {',
        'findById(id: ShopId, tenantId: TenantId) { return db.orm.public.Shop.first({ id });',
      ),
      /Database calls must run inside `fromThrowableAsync/,
    ),
    invalid(
      REPO,
      GOOD_REPO.replace(
        "failures.orConflict('create', shopSlugTaken)",
        "failures.infraOnly('findById')",
      ),
      /already used in this repository/,
    ),
    invalid(
      REPO,
      GOOD_REPO.replace("failures.infraOnly('findById')", 'failures.infraOnly(name)'),
      /Operation names are stable string literals/,
    ),
    invalid(
      REPO,
      GOOD_REPO.replace(
        "failures.orConflict('create', shopSlugTaken)",
        "failures.orConflict('create')",
      ),
      /takes the domain error factory as its second argument/,
    ),
    invalid(
      REPO,
      `import { ok } from 'neverthrow';\n${GOOD_REPO}`,
      /Import result helpers from '@lib\/result'/,
    ),
    invalid(
      REPO,
      `${GOOD_REPO}\nconst isUnique = (e) => e.code === 'P2002';`,
      /Do not branch on Prisma\/ORM error code 'P2002'/,
    ),
    invalid(
      REPO,
      `${GOOD_REPO}\nconst isMissing = (e) => e.code === 'ORM.MUTATION_ROW_MISSING';`,
      /Do not branch on Prisma\/ORM error code/,
    ),
    invalid(
      MAPPER,
      "import { db } from '@lib/db';\nexport function toShop() { return db; }",
      /Record mappers are pure conversions/,
    ),
  ],
});

const GOOD_AUDIT = `
import { createAuditLog } from '@lib/logger';
import type { ShopAuditLog, ShopEvent } from '../../domain/ports/shop-audit-log.port';
const LEVEL_BY_EVENT = { 'shop.created': 'info', 'shop.failed': 'warn' } as const satisfies Record<ShopEvent['type'], 'info' | 'warn'>;
export const loggerShopAuditLog: ShopAuditLog = createAuditLog('shop.audit', LEVEL_BY_EVENT);`;

ruleTester.run('architecture/audit-adapter', rules['audit-adapter']!, {
  valid: [
    valid(AUDIT, GOOD_AUDIT),
    valid(
      'src/modules/shop/infrastructure/prisma/prisma-shop.repository.ts',
      'export class NotAnAdapter {}',
    ),
  ],
  invalid: [
    invalid(
      AUDIT,
      GOOD_AUDIT.replace(
        " as const satisfies Record<ShopEvent['type'], 'info' | 'warn'>",
        ' as const',
      ),
      /exhaustive|event→level map/i,
    ),
    invalid(
      AUDIT,
      GOOD_AUDIT.replace(
        "satisfies Record<ShopEvent['type'], 'info' | 'warn'>",
        "satisfies Record<ShopEvent['type'], string>",
      ),
      /event→level map/,
    ),
    invalid(
      AUDIT,
      GOOD_AUDIT.replace("createAuditLog('shop.audit', LEVEL_BY_EVENT)", '{ record() {} }'),
      /exactly one `createAuditLog/,
    ),
    invalid(AUDIT, GOOD_AUDIT.replace("'shop.audit'", "'shop'"), /module-scoped logger name/),
    invalid(
      AUDIT,
      GOOD_AUDIT.replace(
        "createAuditLog('shop.audit', LEVEL_BY_EVENT)",
        "createAuditLog('shop.audit', { 'shop.created': 'info' })",
      ),
      /Pass `LEVEL_BY_EVENT` as the levels/,
    ),
    invalid(
      AUDIT,
      `${GOOD_AUDIT}\nexport class LoggerShopAuditLog { record() {} }`,
      /Do not hand-write the audit mechanism/,
    ),
  ],
});
