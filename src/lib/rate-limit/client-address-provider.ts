import type { Clock } from '@lib/clock';
import type { ClientAddressSettings } from '@lib/config/server';

import { createClientAddressResolver } from './client-address';
import { createLogThrottle } from './rate-limit-log';

import type { HeaderReader, UnresolvedReason } from './client-address';
import type { RateLimitLog } from './rate-limit-log';
import type { RateLimitSubject } from './rate-limit-subject';

const DEFAULT_LOG_INTERVAL_MS = 10_000;

/** What a client-keyed limit is counted against: the resolved address, or "could not tell". */
export type ClientSubject = Extract<RateLimitSubject, { kind: 'client' | 'unresolved-client' }>;

/**
 * The port use cases receive to learn who is calling, like `CurrentActorProvider` does for
 * signed-in users. The address comes from trusted request metadata read at the boundary, never
 * from a form field or action argument, so a client cannot choose it.
 */
export interface ClientAddressProvider {
  /** Never rejects and never returns a guess: an address that cannot be trusted is `unresolved-client`. */
  current(): Promise<ClientSubject>;
}

/** What does not depend on the current request: how to resolve, and how to report what could not be. */
export interface ClientSubjectResolverDeps {
  readonly settings: ClientAddressSettings;
  readonly clock: Clock;
  readonly log: RateLimitLog;
  readonly logIntervalMs?: number;
}

export interface ClientAddressProviderDeps extends ClientSubjectResolverDeps {
  /** Reads the current request's headers; rejects outside a request (`next/headers` does). */
  readonly getHeaders: () => Promise<HeaderReader>;
}

/**
 * The request-independent half of a provider: the trusted-proxy list and the log throttle, built
 * once and shared by every request. Both methods are synchronous, never throw, and never guess.
 */
export interface ClientSubjectResolver {
  fromHeaders(headers: HeaderReader): ClientSubject;
  /** For code that runs outside a request (build time, a background job, a test). */
  withoutRequest(): ClientSubject;
}

/**
 * Builds the resolver. Throws when `settings` are unusable (a malformed trusted-proxy list); the
 * configuration schema reports the same at startup. An address that cannot be resolved is logged
 * once per interval and reason, as a warning when it signals a misconfiguration and as info when
 * the operator chose `none`. Neither the header nor any address is ever logged.
 */
export function createClientSubjectResolver(
  deps: ClientSubjectResolverDeps,
): ClientSubjectResolver {
  const resolve = createClientAddressResolver(deps.settings);
  const throttle = createLogThrottle(deps.clock, deps.logIntervalMs ?? DEFAULT_LOG_INTERVAL_MS);

  function unresolved(reason: UnresolvedReason): ClientSubject {
    const decision = throttle.admit(`client_unresolved:${reason}`);
    if (decision.write) {
      const context = {
        reason,
        ...(decision.suppressed > 0 ? { suppressed: decision.suppressed } : {}),
      };
      if (reason === 'source_disabled') {
        deps.log.info('rate_limit.client_unresolved', context);
      } else {
        deps.log.warn('rate_limit.client_unresolved', context);
      }
    }
    return { kind: 'unresolved-client' };
  }

  return {
    fromHeaders(headers) {
      const result = resolve(headers);
      return result.status === 'resolved'
        ? { kind: 'client', address: result.address }
        : unresolved(result.reason);
    },
    withoutRequest: () => unresolved('no_request'),
  };
}

/** Joins a resolver to the framework's way of reading the current request's headers. */
export function providerFor(
  resolver: ClientSubjectResolver,
  getHeaders: () => Promise<HeaderReader>,
): ClientAddressProvider {
  return {
    async current() {
      let headers: HeaderReader;
      try {
        headers = await getHeaders();
      } catch {
        return resolver.withoutRequest();
      }
      return resolver.fromHeaders(headers);
    },
  };
}

/**
 * Builds the provider. Throws when `settings` are unusable, like `createClientSubjectResolver`.
 * Every call builds its own resolver, so call it once; `getClientAddressProvider` is the
 * application's entry point and shares one resolver between all the providers it hands out.
 */
export function createClientAddressProvider(
  deps: ClientAddressProviderDeps,
): ClientAddressProvider {
  return providerFor(createClientSubjectResolver(deps), deps.getHeaders);
}
