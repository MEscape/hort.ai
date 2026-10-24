/**
 * A complete, standard business module ("inventory") as source text.
 *
 * It is NOT registered anywhere: not in the ESLint config, not in the
 * module policy. If it passes the lint rules and the tree checks as-is,
 * a developer adding a standard module needs no configuration change.
 */
export const MODULE = 'inventory';
const M = `src/modules/${MODULE}`;

export function standardModule(): Record<string, string> {
  return {
    // ---------------------------------------------------------------- domain
    [`${M}/domain/models/ids.ts`]: `import { ok } from '@lib/result';
import type { ValidationAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';
import type { Brand } from '@lib/utils';

export type ItemId = Brand<string, 'ItemId'>;

export function toItemId(raw: string): ItemId {
  return raw as ItemId;
}

export function parseItemId(raw: string): AppResult<ItemId, ValidationAppError> {
  return ok(toItemId(raw));
}
`,
    [`${M}/domain/models/item.ts`]: `import type { TenantId } from '@modules/auth';

import type { ItemId } from './ids';

export interface Item {
  readonly id: ItemId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly createdAt: Date;
}
`,
    [`${M}/domain/errors/inventory-errors.ts`]: `import { notFoundError } from '@lib/errors';

export const INVENTORY_ERROR_CODES = {
  notFound: 'inventory.not_found',
  persistenceFailed: 'inventory.persistence_failed',
} as const;

export const INVENTORY_VALIDATION_CODES = {
  nameRequired: 'inventory.name_required',
} as const;

export function itemNotFound() {
  return notFoundError(INVENTORY_ERROR_CODES.notFound, 'Item');
}
`,
    [`${M}/domain/ports/inventory-audit-log.port.ts`]: `import type { ItemId } from '../models/ids';

export type InventoryEvent =
  | { readonly type: 'inventory.item_created'; readonly itemId: ItemId }
  | { readonly type: 'inventory.item_failed'; readonly itemId: ItemId };

export interface InventoryAuditLog {
  record(event: InventoryEvent): void;
}
`,
    [`${M}/domain/ports/item.repository.ts`]: `import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import type { TenantId } from '@modules/auth';

import type { ItemId } from '../models/ids';
import type { Item } from '../models/item';

export interface ItemRepository {
  findById(id: ItemId, tenantId: TenantId): AppResultAsync<Item | null, InfrastructureAppError>;
  listByTenant(tenantId: TenantId, limit: number): AppResultAsync<readonly Item[], InfrastructureAppError>;
}
`,
    // ----------------------------------------------------------- application
    [`${M}/application/inventory-dependencies.ts`]: `import type { AuthorizationService } from '@modules/auth';

import type { InventoryAuditLog } from '../domain/ports/inventory-audit-log.port';
import type { ItemRepository } from '../domain/ports/item.repository';

export interface InventoryDependencies {
  readonly authorization: AuthorizationService;
  readonly items: ItemRepository;
  readonly audit: InventoryAuditLog;
}

export interface PublicInventoryDependencies {
  readonly items: ItemRepository;
}
`,
    [`${M}/application/inventory-limits.ts`]: `export const ITEM_LIST_LIMITS = { default: 25, min: 1, max: 100 } as const;
`,
    [`${M}/application/inventory-scope.ts`]: `import type { ResourceScope } from '@modules/auth';

import type { Item } from '../domain/models/item';

export function scopeOf(item: Item): ResourceScope {
  return { tenantId: item.tenantId };
}
`,
    [`${M}/application/inventory-view-mappers.ts`]: `import type { Item } from '../domain/models/item';

import type { ItemView } from './contracts/inventory-views';

export function toItemView(item: Item): ItemView {
  return { id: item.id, name: item.name, createdAt: item.createdAt };
}
`,
    [`${M}/application/contracts/inventory-views.ts`]: `export interface ItemView {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}
`,
    [`${M}/application/contracts/inventory-constraints.ts`]: `export { INVENTORY_ERROR_CODES, INVENTORY_VALIDATION_CODES } from '../../domain/errors/inventory-errors';
`,
    [`${M}/application/load-authorized-item.ts`]: `import type { Actor, AuthorizationError, Permission } from '@modules/auth';
import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { itemNotFound } from '../domain/errors/inventory-errors';
import { parseItemId } from '../domain/models/ids';
import type { Item } from '../domain/models/item';

import type { InventoryDependencies } from './inventory-dependencies';
import { scopeOf } from './inventory-scope';

export function loadAuthorizedItem(
  deps: InventoryDependencies,
  rawId: string,
  permission: Permission
): AppResultAsync<{ readonly actor: Actor; readonly item: Item }, AuthorizationError | InfrastructureAppError> {
  const { authorization, items } = deps;
  return authorization.requireInTenant(permission).andThen((actor) =>
    parseItemId(rawId)
      .asyncAndThen((id) => items.findById(id, actor.tenantId))
      .andThen((item) => (item === null ? errAsync(itemNotFound()) : okAsync(item)))
      .andThen((item) => authorization.requireOnResource(permission, scopeOf(item)).map((verified) => ({ actor: verified, item })))
  );
}
`,
    [`${M}/application/commands/create-item.ts`]: `import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { AuthorizationError } from '@modules/auth';

import type { InventoryDependencies } from '../inventory-dependencies';
import type { ItemView } from '../contracts/inventory-views';

export type CreateItemError = AuthorizationError | InfrastructureAppError;

export class CreateItem {
  constructor(private readonly deps: InventoryDependencies) {}

  execute(input: { readonly name: string }): AppResultAsync<ItemView, CreateItemError> {
    const { authorization, audit } = this.deps;
    return authorization.requireInTenant('inventory.create').andThen((actor) => {
      audit.record({ type: 'inventory.item_created', itemId: actor.id as never });
      return okAsync({ id: input.name, name: input.name, createdAt: new Date() });
    });
  }
}
`,
    [`${M}/application/queries/get-item-by-id.ts`]: `import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import type { AuthorizationError } from '@modules/auth';

import type { InventoryDependencies } from '../inventory-dependencies';
import { loadAuthorizedItem } from '../load-authorized-item';
import { toItemView } from '../inventory-view-mappers';
import type { ItemView } from '../contracts/inventory-views';

export class GetItemById {
  constructor(private readonly deps: InventoryDependencies) {}

  execute(id: string): AppResultAsync<ItemView, AuthorizationError | InfrastructureAppError> {
    return loadAuthorizedItem(this.deps, id, 'inventory.read').map(({ item }) => toItemView(item));
  }
}
`,
    [`${M}/application/queries/list-items.ts`]: `import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import { clamp } from '@lib/utils';
import type { AuthorizationError } from '@modules/auth';

import type { InventoryDependencies } from '../inventory-dependencies';
import { ITEM_LIST_LIMITS } from '../inventory-limits';
import { toItemView } from '../inventory-view-mappers';
import type { ItemView } from '../contracts/inventory-views';

export class ListItems {
  constructor(private readonly deps: InventoryDependencies) {}

  execute(requested?: number): AppResultAsync<readonly ItemView[], AuthorizationError | InfrastructureAppError> {
    const limit = clamp(requested ?? ITEM_LIST_LIMITS.default, ITEM_LIST_LIMITS.min, ITEM_LIST_LIMITS.max);
    return this.deps.authorization
      .requireInTenant('inventory.read')
      .andThen((actor) => this.deps.items.listByTenant(actor.tenantId, limit))
      .map((items) => items.map(toItemView));
  }
}
`,
    [`${M}/application/queries/get-public-item.ts`]: `import type { InfrastructureAppError, NotFoundAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { PublicInventoryDependencies } from '../inventory-dependencies';
import type { ItemView } from '../contracts/inventory-views';

/**
 * Public catalogue entry.
 *
 * @authorization public the catalogue is world-readable; no permission applies
 * @rate-limit none a cached read of what the site shows anyway; a budget would make every page dynamic
 */
export class GetPublicItem {
  constructor(private readonly deps: PublicInventoryDependencies) {}

  execute(id: string): AppResultAsync<ItemView, NotFoundAppError | InfrastructureAppError> {
    return this.deps.items.findPublic(id);
  }
}
`,
    // -------------------------------------------------------- infrastructure
    [`${M}/infrastructure/prisma/item-record-mapper.ts`]: `import { toTenantId } from '@modules/auth';

import { toItemId } from '../../domain/models/ids';
import type { Item } from '../../domain/models/item';

export interface ItemRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly createdAt: Date;
}

export const ITEM_SELECT = ['id', 'tenantId', 'name', 'createdAt'] as const;

export function toItem(record: ItemRecord): Item {
  return { id: toItemId(record.id), tenantId: toTenantId(record.tenantId), name: record.name, createdAt: record.createdAt };
}
`,
    [`${M}/infrastructure/prisma/prisma-item.repository.ts`]: `import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { TenantId } from '@modules/auth';

import { INVENTORY_ERROR_CODES } from '../../domain/errors/inventory-errors';
import type { ItemId } from '../../domain/models/ids';
import type { Item } from '../../domain/models/item';
import type { ItemRepository } from '../../domain/ports/item.repository';

import { ITEM_SELECT, toItem } from './item-record-mapper';

const failures = createPersistenceFailures({
  module: 'inventory.persistence',
  code: INVENTORY_ERROR_CODES.persistenceFailed,
  subject: 'Item',
});

export class PrismaItemRepository implements ItemRepository {
  findById(id: ItemId, tenantId: TenantId): AppResultAsync<Item | null, InfrastructureAppError> {
    return fromThrowableAsync(
      () => db.orm.public.Item.select(...ITEM_SELECT).where({ id, tenantId }).first(),
      failures.infraOnly('findById')
    ).map((record) => (record === null ? null : toItem(record)));
  }

  listByTenant(tenantId: TenantId, limit: number): AppResultAsync<readonly Item[], InfrastructureAppError> {
    return fromThrowableAsync(
      () => db.orm.public.Item.select(...ITEM_SELECT).where({ tenantId }).limit(limit).all().toArray(),
      failures.infraOnly('listByTenant')
    ).map((records) => records.map(toItem));
  }
}
`,
    [`${M}/infrastructure/audit/logger-inventory-audit-log.ts`]: `import { createAuditLog } from '@lib/logger';

import type { InventoryAuditLog, InventoryEvent } from '../../domain/ports/inventory-audit-log.port';

const LEVEL_BY_EVENT = {
  'inventory.item_created': 'info',
  'inventory.item_failed': 'warn',
} as const satisfies Record<InventoryEvent['type'], 'info' | 'warn'>;

export const loggerInventoryAuditLog: InventoryAuditLog = createAuditLog('inventory.audit', LEVEL_BY_EVENT);
`,
    // ------------------------------------------------------ composition / API
    [`${M}/composition.ts`]: `import 'server-only';

import { getAccessControl } from '@modules/auth';

import { CreateItem } from './application/commands/create-item';
import { GetItemById } from './application/queries/get-item-by-id';
import { GetPublicItem } from './application/queries/get-public-item';
import { ListItems } from './application/queries/list-items';
import { loggerInventoryAuditLog } from './infrastructure/audit/logger-inventory-audit-log';
import { PrismaItemRepository } from './infrastructure/prisma/prisma-item.repository';

const items = new PrismaItemRepository();
const dependencies = { authorization: getAccessControl(), items, audit: loggerInventoryAuditLog };

export const inventoryCommands = { createItem: new CreateItem(dependencies) } as const;

export const inventoryQueries = {
  getItemById: new GetItemById(dependencies),
  listItems: new ListItems(dependencies),
  getPublicItem: new GetPublicItem({ items }),
} as const;
`,
    [`${M}/index.ts`]: `export { inventoryQueries } from './composition';
export { CreateItemForm } from './presentation/components/create-item-form';
export { inventoryRoutes } from './presentation/routes';
export { deInventory, enInventory } from './presentation/i18n/catalog';
export type { ItemView } from './application/contracts/inventory-views';
`,
    // ----------------------------------------------------------- presentation
    [`${M}/presentation/routes.ts`]: `export const inventoryRoutes = {
  list: () => '/inventory',
  detail: (id: string) => \`/inventory/\${id}\`,
} as const;
`,
    [`${M}/presentation/schemas/new-item-schema.ts`]: `import { z } from 'zod';

import { INVENTORY_VALIDATION_CODES } from '../../application/contracts/inventory-constraints';

export const newItemSchema = z.object({ name: z.string().min(1, INVENTORY_VALIDATION_CODES.nameRequired) });
`,
    [`${M}/presentation/schemas/parse-item-input.ts`]: `import { createActionInputParser } from '@lib/actions';

export const parseItemInput = createActionInputParser('inventory.validation_failed');
`,
    [`${M}/presentation/dto/item-dto.ts`]: `import type { ItemView } from '../../application/contracts/inventory-views';

export interface ItemDto {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

export function toItemDto(view: ItemView): ItemDto {
  return { id: view.id, name: view.name, createdAt: view.createdAt.toISOString() };
}
`,
    [`${M}/presentation/actions/create-item-action.ts`]: `'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { inventoryCommands } from '../../composition';
import { toItemDto } from '../dto/item-dto';
import type { ItemDto } from '../dto/item-dto';
import { inventoryRoutes } from '../routes';
import { newItemSchema } from '../schemas/new-item-schema';
import { parseItemInput } from '../schemas/parse-item-input';

export async function createItemAction(input: unknown): Promise<ActionResult<ItemDto>> {
  const result = await parseItemInput(newItemSchema, input).asyncAndThen((command) => inventoryCommands.createItem.execute(command));
  if (result.isOk()) {
    revalidatePath(inventoryRoutes.list());
  }
  return toActionResult(result.map(toItemDto));
}
`,
    [`${M}/presentation/messages/message-keys.ts`]: `import { INVENTORY_ERROR_CODES, INVENTORY_VALIDATION_CODES } from '../../application/contracts/inventory-constraints';

/** Codes -> translation keys, relative to the inventory namespace. */
export const MESSAGE_KEY_BY_CODE = {
  [INVENTORY_ERROR_CODES.notFound]: 'errors.notFound',
  [INVENTORY_ERROR_CODES.persistenceFailed]: 'errors.generic',
  [INVENTORY_VALIDATION_CODES.nameRequired]: 'validation.nameRequired',
} as const satisfies Record<string, string>;

export const GENERIC_ERROR_MESSAGE_KEY = 'errors.generic';

export function messageKeyForCode(code: string): string {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code) ? MESSAGE_KEY_BY_CODE[code as keyof typeof MESSAGE_KEY_BY_CODE] : GENERIC_ERROR_MESSAGE_KEY;
}
`,
    [`${M}/presentation/i18n/en.json`]: JSON.stringify(
      catalog('Not found', 'Something went wrong', 'Name is required'),
      null,
      2,
    ),
    [`${M}/presentation/i18n/de.json`]: JSON.stringify(
      catalog('Nicht gefunden', 'Etwas ist schiefgelaufen', 'Name ist erforderlich'),
      null,
      2,
    ),
    [`${M}/presentation/i18n/catalog.ts`]: `import de from './de.json';
import en from './en.json';

export const enInventory = en.inventory;
export const deInventory = de.inventory;
`,
    [`${M}/presentation/components/create-item-form.tsx`]: `'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { useTranslations } from '@i18n/client';
import { applyActionError } from '@lib/actions';

import { createItemAction } from '../actions/create-item-action';
import { newItemSchema } from '../schemas/new-item-schema';

// @unsaved-work none creating, not editing; one field
export function CreateItemForm() {
  const t = useTranslations('inventory');
  const form = useForm({ resolver: zodResolver(newItemSchema), defaultValues: { name: '' } });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await createItemAction(values);
    if (!result.ok) {
      applyActionError(result.error, form.setError);
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <TextField id="name" label={t('fields.name')} {...form.register('name')} />
      <Button type="submit">{t('actions.create')}</Button>
    </form>
  );
}
`,
    // ------------------------------------------------- app-level registration
    'src/i18n/locales/en.ts': `import { enInventory as inventory } from '@modules/inventory';

const messages = { inventory } as const;

export default messages;
`,
    'src/i18n/locales/de.ts': `import { deInventory as inventory } from '@modules/inventory';

const messages = { inventory } as const;

export default messages;
`,
    'src/i18n/messages/en.json': JSON.stringify({ unexpected: 'Unexpected error' }),
    'src/i18n/messages/de.json': JSON.stringify({ unexpected: 'Unerwarteter Fehler' }),
  };
}

function catalog(notFound: string, generic: string, nameRequired: string) {
  return {
    inventory: {
      fields: { name: 'Name' },
      actions: { create: 'Create' },
      errors: { notFound, generic },
      validation: { nameRequired },
    },
  };
}
