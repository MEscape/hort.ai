import type { Brand } from '@lib/utils';

/** Opaque identity of an authenticated parent account. Never a Better Auth type. */
export type ActorId = Brand<string, 'ActorId'>;
export type TenantId = Brand<string, 'TenantId'>;

/**
 * Brands an id the authentication provider has already verified. Only
 * infrastructure adapters call this.
 */
export function toActorId(raw: string): ActorId {
  return raw as ActorId; // Brand constructor: the cast is only permitted here.
}

/**
 * Brands a tenant id that is already known to be valid (read from storage or built by
 * `createTenantId`). Never pass a request value.
 */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId; // Brand constructor: the cast is only permitted here.
}
