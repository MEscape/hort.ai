import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
// Prisma 8 reads and writes `DateTime` through the global `Temporal`, which Node 24 (pinned in
// `.nvmrc`) lacks. The `global` entry installs the polyfill only when there is no native
// implementation, and it must run before the first query decodes a row or fills a `now()` default.
import 'temporal-polyfill/global';

import { serverEnv } from '@lib/config/server';
import { logger } from '@lib/logger';

import contractJson from './contract.json' with { type: 'json' };
import { queryLogger } from './query-logger';

import type { Contract } from './contract.d';

/**
 * Prisma client singleton. This is the ONLY file in the codebase that may
 * import `@prisma/orm-postgres/runtime` directly — persistence.md:
 * "Prisma is an infrastructure concern"; boundaries.md enforces this at
 * the lint level. Repositories import `db` from here; nothing else should.
 *
 * The globalThis cache prevents Next.js's dev-mode module reloading from
 * creating a new Prisma client (and a new connection pool) on every hot
 * reload. Without this cache, active development can exhaust the
 * database's connection limit within minutes.
 *
 * Prisma 8 uses the generated contract and the ORM Postgres runtime rather
 * than the traditional `PrismaClient` from `@prisma/client`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof postgres<Contract>> | undefined;
};

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });

/**
 * Builds the database connection URL with pool parameters derived from
 * the validated server configuration.
 *
 * `DATABASE_URL`, `DATABASE_POOL_SIZE`, and
 * `DATABASE_POOL_TIMEOUT_SECONDS` are read from `serverEnv`, not directly
 * from `process.env`. This keeps configuration access centralized in
 * `@lib/config` and follows configuration.md:
 * "do not access process.env throughout application code".
 *
 * The pool parameters are appended using Prisma's standard
 * `connection_limit` and `pool_timeout` connection-string parameters.
 * This allows pool sizing to differ between environments without changing
 * this infrastructure module.
 *
 * `serverEnv.DATABASE_URL` is required by the configuration schema, so
 * missing database configuration fails during application startup rather
 * than falling back to a local or otherwise implicit database.
 */
function buildConnectionUrl(): string {
  const url = new URL(serverEnv.DATABASE_URL);

  url.searchParams.set('connection_limit', String(serverEnv.DATABASE_POOL_SIZE));

  url.searchParams.set('pool_timeout', String(serverEnv.DATABASE_POOL_TIMEOUT_SECONDS));

  return url.toString();
}

/**
 * Creates the Prisma ORM Postgres client using the generated database
 * contract and the environment-specific connection configuration.
 *
 * `contractFromJson` validates the emitted `contract.json` once and types it as
 * the generated `Contract`; the Prisma 8 ORM Postgres runtime takes it as `contract`, while the connection URL supplies the
 * database endpoint and pool configuration.
 *
 * `queryLogger` is registered here rather than left for callers to add,
 * so every query on this client is observed the same way in every
 * environment — observability.md: "log at application/infrastructure
 * boundaries". The connection URL itself is never logged: it can carry
 * embedded database credentials, so only `buildConnectionUrl`'s caller
 * (this function) ever sees it.
 */
function createPrismaClient(): ReturnType<typeof postgres<Contract>> {
  return postgres<Contract>({
    contract: contractFromJson<Contract>(contractJson),
    url: buildConnectionUrl(),
    middleware: [queryLogger()],
  });
}

/**
 * Reuse the existing client when available; otherwise create exactly one.
 *
 * In development, Next.js may reload modules without terminating the
 * process. Storing the client on globalThis ensures those reloads reuse
 * the same connection pool instead of creating additional pools.
 *
 * Production does not need the global cache because the application
 * lifecycle is expected to be stable and module initialization occurs
 * once per process.
 */
export const db = globalForPrisma.prisma ?? createPrismaClient();

if (serverEnv.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

/**
 * Gracefully terminates the database connection.
 *
 * This is primarily intended for long-running processes such as workers,
 * scripts, and CLI processes. The Next.js request lifecycle does not
 * normally require explicit disconnection.
 *
 * Prisma 8's ORM Postgres runtime exposes `close()` rather than the
 * `$disconnect()` method used by the legacy PrismaClient API.
 *
 * A failure here is logged once at this boundary (observability.md) and
 * rethrown as-is, rather than translated into a domain/application error
 * type — a process shutting down is not a case any caller is expected to
 * recover from (errors.md: reserve `throw` for failures no caller can
 * meaningfully handle).
 */
export async function disconnectDb(): Promise<void> {
  try {
    await db.close();
  } catch (error) {
    dbLogger.error('db.disconnect_failed', error);
    throw error;
  }
}
