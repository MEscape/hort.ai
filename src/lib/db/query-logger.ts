import { logger } from '@lib/logger';

import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

const dbLogger = logger.withContext({ module: 'infrastructure.prisma' });

/**
 * Hands the SQL text from `beforeEncode` to `activityEnded`, which sees only the unlowered plan.
 * Every hook of one activity receives the same context object, so it keys the text.
 */
const sqlByActivity = new WeakMap<object, string>();

/**
 * Query-observability middleware for the Prisma ORM Postgres runtime.
 *
 * Prisma 8 has no `log: [...]` client option; the runtime instead calls
 * lifecycle hooks on middleware registered in the `middleware` array (see
 * client.ts): `beforeEncode` sees the lowered SQL, `activityEnded` the
 * outcome. `ctx.log` is a documented no-op on Postgres today, so this middleware routes through the app's own
 * `logger` instead — observability.md: "do not use console.log for
 * application observability", "log at application/infrastructure
 * boundaries".
 *
 * Every query is logged at `debug` with full SQL/timing detail, and a
 * failed query is additionally logged at `warn` regardless of level.
 * This middleware makes no `NODE_ENV` decision itself: `@lib/logger`
 * filters by `LOG_LEVEL` at the sink, so `LOG_LEVEL=debug` in development
 * shows every query and `LOG_LEVEL=warn` (typical in production) shows
 * only failed ones — configuration.md: centralize environment-driven
 * behavior instead of branching on `NODE_ENV` at each call site.
 *
 * Only the lowered SQL text (the parameterized query text, e.g. `... = $1`) and
 * timing/row-count metadata are logged — never bound parameter values,
 * which may carry user data or secrets (security.md / observability.md:
 * "never log secrets or sensitive data").
 */
export function queryLogger(): SqlMiddleware {
  return {
    name: 'query-logger',
    familyId: 'sql',

    beforeEncode(plan, ctx) {
      sqlByActivity.set(ctx, plan.sql);
    },

    activityEnded(_activity, result, ctx) {
      if (result.kind !== 'statement') {
        return Promise.resolve();
      }
      const fields = {
        sql: sqlByActivity.get(ctx),
        returns: result.returns,
        rowCount: result.returns === 'rows' ? result.rowCount : (result.stats?.affectedRows ?? 0),
        latencyMs: Math.round(result.latencyMs),
        outcome: result.outcome,
        source: result.source,
      };
      dbLogger.debug('db.query', fields);
      if (result.outcome === 'failed') {
        dbLogger.warn('db.query.failed', fields);
      }
      return Promise.resolve();
    },
  };
}
