/**
 * Preloaded by the CLI scripts that run server modules outside Next (`db:seed`,
 * `curriculum:ingest`): `tsx --import ./scripts/lib/server-runtime.ts …`.
 *
 * `server-only` throws unless it resolves through the `react-server` condition. That condition
 * cannot be set for the whole process: it also selects the React Server build of `react`, while
 * Node still evaluates client modules (next-intl navigation, reached through `@i18n`) that Next
 * would only reference, and they fail with "react does not provide useEffect" (#100). So the
 * scripts run without it, and only the marker resolves to its empty build, as it does on the server.
 */
import { registerHooks } from 'node:module';

const SERVER_ONLY = 'server-only';
const EMPTY_SERVER_ONLY = import.meta.resolve(SERVER_ONLY).replace(/index\.js$/u, 'empty.js');

registerHooks({
  resolve: (specifier, context, nextResolve) =>
    specifier === SERVER_ONLY
      ? { url: EMPTY_SERVER_ONLY, shortCircuit: true }
      : nextResolve(specifier, context),
});
