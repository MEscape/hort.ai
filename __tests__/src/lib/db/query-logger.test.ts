import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

type BeforeEncode = NonNullable<SqlMiddleware['beforeEncode']>;
type ActivityEnded = NonNullable<SqlMiddleware['activityEnded']>;
type Ended = Parameters<ActivityEnded>[1];

interface Line {
  level: string;
  message: string;
  context: Record<string, unknown>;
}

let stdout: ReturnType<typeof vi.spyOn>;

function logged(): Line[] {
  return (stdout.mock.calls as unknown[][]).map((call) => JSON.parse(String(call[0])) as Line);
}

/** The runtime builds plans, contexts and activities; the middleware only needs these members. */
async function loadMiddleware(level = 'debug') {
  vi.resetModules();
  vi.stubEnv('LOG_LEVEL', level);
  const { queryLogger } = await import('@lib/db/query-logger');
  const middleware = queryLogger();
  const context = {};
  return {
    middleware,
    encode: (sql: string) =>
      // -- the real plan and context types are internal to the runtime
      middleware.beforeEncode?.(
        { sql } as unknown as Parameters<BeforeEncode>[0],
        context as Parameters<BeforeEncode>[1],
      ),
    end: (result: object) =>
      middleware.activityEnded?.(
        {} as Parameters<ActivityEnded>[0],
        result as Ended,
        context as Parameters<ActivityEnded>[2],
      ),
  };
}

const rows = {
  kind: 'statement',
  returns: 'rows',
  rowCount: 3,
  outcome: 'succeeded',
  source: 'driver',
};

beforeEach(() => {
  stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('queryLogger', () => {
  it('identifies itself as an SQL middleware', async () => {
    const { middleware } = await loadMiddleware();

    expect(middleware).toMatchObject({ name: 'query-logger', familyId: 'sql' });
  });

  it('logs the SQL text, row count, rounded latency, outcome and source of a query at debug', async () => {
    const { encode, end } = await loadMiddleware();

    await encode('SELECT * FROM profile WHERE id = $1');
    await end({ ...rows, latencyMs: 12.6 });

    expect(logged()).toEqual([
      {
        level: 'debug',
        message: 'db.query',
        timestamp: expect.any(String) as string,
        context: {
          module: 'infrastructure.prisma',
          sql: 'SELECT * FROM profile WHERE id = $1',
          returns: 'rows',
          rowCount: 3,
          latencyMs: 13,
          outcome: 'succeeded',
          source: 'driver',
        },
      },
    ]);
  });

  it('logs the affected rows of a statement that returns stats, and zero without stats', async () => {
    const { encode, end } = await loadMiddleware();
    const stats = {
      kind: 'statement',
      returns: 'stats',
      outcome: 'succeeded',
      source: 'driver',
      latencyMs: 1,
    };

    await encode('UPDATE a SET b = $1');
    await end({ ...stats, stats: { affectedRows: 5 } });
    await end(stats);

    expect(logged().map((line) => line.context['rowCount'])).toEqual([5, 0]);
  });

  it('adds a warning for a failed query', async () => {
    const { encode, end } = await loadMiddleware();

    await encode('INSERT INTO a VALUES ($1)');
    await end({ ...rows, outcome: 'failed', latencyMs: 2 });

    expect(logged().map((line) => [line.level, line.message])).toEqual([
      ['debug', 'db.query'],
      ['warn', 'db.query.failed'],
    ]);
    expect(logged()[1]?.context).toMatchObject({
      sql: 'INSERT INTO a VALUES ($1)',
      outcome: 'failed',
    });
  });

  it('shows only failed queries when the log level is warn', async () => {
    const { encode, end } = await loadMiddleware('warn');

    await encode('SELECT 1');
    await end({ ...rows, latencyMs: 1 });
    await end({ ...rows, outcome: 'failed', latencyMs: 1 });

    expect(logged().map((line) => line.message)).toEqual(['db.query.failed']);
  });

  it('ignores activities that are not statements', async () => {
    const { end } = await loadMiddleware();

    await end({ kind: 'transaction', outcome: 'succeeded' });

    expect(logged()).toEqual([]);
  });

  it('logs no SQL for a statement whose text it never saw', async () => {
    const { end } = await loadMiddleware();

    await end({ ...rows, latencyMs: 1 });

    expect(logged()[0]?.context).not.toHaveProperty('sql', expect.any(String));
  });

  it('keeps the SQL of one activity apart from another', async () => {
    const { middleware } = await loadMiddleware();
    const first = {};
    const second = {};
    const plan = (sql: string) => ({ sql }) as unknown as Parameters<BeforeEncode>[0];

    await middleware.beforeEncode?.(plan('first'), first as Parameters<BeforeEncode>[1]);
    await middleware.beforeEncode?.(plan('second'), second as Parameters<BeforeEncode>[1]);
    await middleware.activityEnded?.(
      {} as Parameters<ActivityEnded>[0],
      { ...rows, latencyMs: 1 } as Ended,
      first as Parameters<ActivityEnded>[2],
    );

    expect(logged()[0]?.context['sql']).toBe('first');
  });
});
