import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import { Pool } from 'pg';
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

const MS_PER_SECOND = 1000;

/**
 * Builds the connection pool the client runs on, sized from the validated server configuration.
 *
 * Prisma 8's runtime creates its own `pg` pool from a URL and reads none of the pool parameters
 * the earlier Prisma versions took in the connection string (`connection_limit`, `pool_timeout`),
 * so the pool is made here and handed over: `DATABASE_POOL_SIZE` is `max` (connections per
 * process), `DATABASE_POOL_TIMEOUT_SECONDS` is how long a query waits for a free connection
 * before failing. Each serverless instance owns one pool, so keep the size small there.
 *
 * `DATABASE_URL` is required by the configuration schema, so missing database configuration fails
 * during application startup rather than falling back to an implicit database. The URL itself is
 * never logged: it can carry the database credentials.
 *
 * An idle connection that the server drops emits `error` on the pool; unhandled, that would crash
 * the process, so it is logged once here (observability.md: unexpected errors at the boundary).
 */
function createPool(): Pool {
  const pool = new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: serverEnv.DATABASE_POOL_SIZE,
    connectionTimeoutMillis: serverEnv.DATABASE_POOL_TIMEOUT_SECONDS * MS_PER_SECOND,
  });
  pool.on('error', (error) => {
    dbLogger.error('db.pool_error', error);
  });
  return pool;
}

/**
 * Creates the Prisma ORM Postgres client using the generated database
 * contract and the environment-specific connection configuration.
 *
 * `contractFromJson` validates the emitted `contract.json` once and types it as
 * the generated `Contract`; the Prisma 8 ORM Postgres runtime takes it as `contract`, and
 * the pool from `createPool` supplies the database endpoint and pool configuration.
 *
 * `queryLogger` is registered here rather than left for callers to add,
 * so every query on this client is observed the same way in every
 * environment — observability.md: "log at application/infrastructure
 * boundaries".
 */
function createPrismaClient(): ReturnType<typeof postgres<Contract>> {
  return postgres<Contract>({
    contract: contractFromJson<Contract>(contractJson),
    pg: createPool(),
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
