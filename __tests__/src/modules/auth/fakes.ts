import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import { PARENT_ROLE } from '@modules/auth/domain/models/role';
import type {
  Authenticator,
  AuthenticatorError,
} from '@modules/auth/domain/ports/authenticator.port';
import type {
  CurrentActorError,
  CurrentActorProvider,
} from '@modules/auth/domain/ports/current-actor-provider.port';
import type {
  SecurityAuditLog,
  SecurityEvent,
} from '@modules/auth/domain/ports/security-audit-log.port';

import type { ClientAddressProvider, ClientSubject } from '@lib/rate-limit';
import type { AppResultAsync } from '@lib/result';
import { errAsync, okAsync } from '@lib/result';

export const TENANT = toTenantId('default');
export const OTHER_TENANT = toTenantId('other');

/** A signed-in parent; override what a test is about. */
export function parent(overrides: Partial<Actor> = {}): Actor {
  return { id: toActorId('parent-1'), tenantId: TENANT, roles: [PARENT_ROLE], ...overrides };
}

export function signedInAs(actor: Actor): CurrentActorProvider {
  return { getCurrentActor: () => okAsync(actor) };
}

export function failingWith(error: CurrentActorError): CurrentActorProvider {
  return { getCurrentActor: () => errAsync(error) };
}

/** Collects every event, so a test asserts on what was recorded rather than on a call count. */
export function recordingAudit(): SecurityAuditLog & { readonly events: SecurityEvent[] } {
  const events: SecurityEvent[] = [];
  return {
    events,
    record: (event) => {
      events.push(event);
    },
  };
}

export type Flow = 'signIn' | 'signUp' | 'signOut' | 'requestPasswordReset' | 'resetPassword';

/**
 * An authenticator that answers every flow with `outcome` and remembers what it was asked, in
 * order. What it was asked is the observable side effect a use case must not cause when it stops
 * early (invalid input, a spent budget).
 */
export function fakeAuthenticator(outcome: AuthenticatorError | null = null): Authenticator & {
  readonly calls: Array<{ readonly flow: Flow; readonly input: unknown }>;
} {
  const calls: Array<{ readonly flow: Flow; readonly input: unknown }> = [];
  const answer = (flow: Flow, input: unknown): AppResultAsync<void, AuthenticatorError> => {
    calls.push({ flow, input });
    return outcome === null ? okAsync(undefined) : errAsync(outcome);
  };
  return {
    calls,
    signIn: (input) => answer('signIn', input),
    signUp: (input) => answer('signUp', input),
    signOut: () => answer('signOut', undefined),
    requestPasswordReset: (input) => answer('requestPasswordReset', input),
    resetPassword: (input) => answer('resetPassword', input),
  };
}

export function clientAt(address: string): ClientAddressProvider {
  const subject: ClientSubject = { kind: 'client', address };
  return { current: () => Promise.resolve(subject) };
}

export const UNRESOLVED_CLIENT: ClientAddressProvider = {
  current: () => Promise.resolve({ kind: 'unresolved-client' }),
};
