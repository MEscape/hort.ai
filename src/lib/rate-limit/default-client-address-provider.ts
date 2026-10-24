import 'server-only';

import { systemClock } from '@lib/clock';
import { resolveRateLimitSettings, serverEnv } from '@lib/config/server';
import { createLazyCell, resolveLazy } from '@lib/utils';
import type { LazyCell } from '@lib/utils';

import { createClientSubjectResolver, providerFor } from './client-address-provider';
import { createRateLimitLog } from './rate-limit-logger';

import type { HeaderReader } from './client-address';
import type {
  ClientAddressProvider,
  ClientSubject,
  ClientSubjectResolver,
} from './client-address-provider';

const cell: LazyCell<ClientSubjectResolver> = createLazyCell();

/** Nothing is known, so nothing is guessed: the policy's `onUnresolvedClient` decides. */
const UNRESOLVED: ClientSubject = { kind: 'unresolved-client' };

function resolver(): ClientSubjectResolver | null {
  const built = resolveLazy({
    cell,
    build: () =>
      createClientSubjectResolver({
        settings: resolveRateLimitSettings(serverEnv).clientAddress,
        clock: systemClock,
        log: createRateLimitLog(),
      }),
    clock: systemClock,
    onFailure: (thrown) => {
      createRateLimitLog().error('rate_limit.client_unresolved', thrown, {
        reason: 'misconfigured',
      });
    },
  });
  return built.isReady ? built.value : null;
}

/**
 * The application's client-address provider, built from validated configuration. Only
 * `composition.ts` files call this, passing the framework's header reader:
 * `getClientAddressProvider(() => headers())`.
 *
 * Like `getRateLimiter`, it reads no configuration until the first request that needs an address,
 * so importing a composition root (during `next build`, say) can neither read the environment nor
 * throw; the trusted-proxy list and the log throttle are built once and shared, whatever the
 * number of providers handed out. If the configuration turns out to be unusable, every address is
 * `unresolved-client` (never a guess) and the failure is logged once per few seconds as an error.
 */
export function getClientAddressProvider(
  getHeaders: () => Promise<HeaderReader>,
): ClientAddressProvider {
  return providerFor(
    {
      fromHeaders: (headers) => resolver()?.fromHeaders(headers) ?? UNRESOLVED,
      withoutRequest: () => resolver()?.withoutRequest() ?? UNRESOLVED,
    },
    getHeaders,
  );
}
