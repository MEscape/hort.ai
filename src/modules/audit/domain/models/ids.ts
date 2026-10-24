import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { AUDIT_VALIDATION_CODES, auditFieldInvalid } from '../errors/audit-errors';

/** The tenant an entry belongs to. Same brand as the rest of the app's tenant id. */
export type TenantId = Brand<string, 'TenantId'>;

/** A signed-in member who caused an entry. Same brand as the auth module's own. */
export type ActorId = Brand<string, 'ActorId'>;

const ID_MAX_LENGTH = 128;

const isValidId = (raw: string) => raw.length > 0 && raw.length <= ID_MAX_LENGTH;

/** Brands an id read from storage or handed over by a module that already checked it. */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId; // Brand constructor: the cast is only permitted here.
}

/** Brands an id read from storage or handed over by a module that already checked it. */
export function toActorId(raw: string): ActorId {
  return raw as ActorId; // Brand constructor: the cast is only permitted here.
}

/** Brands a tenant id that arrived from a request, after checking its shape. */
export const parseTenantId = createIdParser({
  isValid: isValidId,
  brand: toTenantId,
  mapError: () => auditFieldInvalid('tenantId', AUDIT_VALIDATION_CODES.idInvalid),
});

/** Brands an actor id that arrived from a request (a filter in the address), after checking its shape. */
export const parseActorId = createIdParser({
  isValid: isValidId,
  brand: toActorId,
  mapError: () => auditFieldInvalid('actorId', AUDIT_VALIDATION_CODES.idInvalid),
});
