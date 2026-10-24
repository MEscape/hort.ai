import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeClient {
  close: () => Promise<void>;
}

interface PoolOptions {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
}

interface ClientOptions {
  pg: { options: PoolOptions; handlers: Map<string, (error: Error) => void> };
  middleware: ReadonlyArray<{ name: string }>;
}

let created: ClientOptions[];
let closeBehavior: () => Promise<void>;
let stderr: ReturnType<typeof vi.spyOn>;

/** Loads `@lib/db/client` fresh, with the Prisma runtime replaced by a client that never connects. */
async function loadClient() {
  vi.resetModules();
  vi.doMock('pg', () => ({
    Pool: class FakePool {
      readonly handlers = new Map<string, (error: Error) => void>();

      constructor(readonly options: PoolOptions) {}

      on(event: string, handler: (error: Error) => void): this {
        this.handlers.set(event, handler);
        return this;
      }
    },
  }));
  vi.doMock('@prisma/orm-postgres/runtime', () => ({
    default: (options: ClientOptions): FakeClient => {
      created.push(options);
      return { close: () => closeBehavior() };
    },
  }));
  return import('@lib/db/client');
}

function cachedClient(): unknown {
  return Reflect.get(globalThis, 'prisma');
}

beforeEach(() => {
  created = [];
  closeBehavior = () => Promise.resolve();
  stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'prisma');
  vi.doUnmock('@prisma/orm-postgres/runtime');
  vi.doUnmock('pg');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('db client', () => {
  it('logs an error of an idle pool connection instead of letting it crash the process', async () => {
    await loadClient();

    created[0]?.pg.handlers.get('error')?.(new Error('connection terminated'));

    expect(stderr).toHaveBeenCalledOnce();
    expect(String(stderr.mock.calls[0]?.[0])).toContain('db.pool_error');
  });

  it('connects to DATABASE_URL with the configured pool settings and the query logger', async () => {
    vi.stubEnv('DATABASE_POOL_SIZE', '7');
    vi.stubEnv('DATABASE_POOL_TIMEOUT_SECONDS', '3');

    await loadClient();

    expect(created).toHaveLength(1);
    const pool = created[0]?.pg.options;
    const url = new URL(pool?.connectionString ?? '');
    expect(url.host).toBe('localhost:5432');
    expect(url.pathname).toBe('/test');
    // The pool is sized here: Prisma 8 would ignore size and timeout given in the URL.
    expect(pool?.max).toBe(7);
    expect(pool?.connectionTimeoutMillis).toBe(3000);
    expect(created[0]?.middleware.map((middleware) => middleware.name)).toEqual(['query-logger']);
  });

  it('exposes the same client through the barrel', async () => {
    const { db } = await loadClient();
    const barrel = await import('@lib/db');

    expect(barrel.db).toBe(db);
  });

  it('reuses the client cached on globalThis across module reloads', async () => {
    const first = await loadClient();
    const second = await loadClient();

    expect(created).toHaveLength(1);
    expect(second.db).toBe(first.db);
    expect(cachedClient()).toBe(first.db);
  });

  it('does not cache the client on globalThis in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Production configuration requires these.
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.test');
    vi.stubEnv('MAIL_PROVIDER', 'smtp');
    vi.stubEnv('MAIL_SMTP_HOST', 'smtp.example.test');
    vi.stubEnv('MAIL_FROM', 'noreply@example.test');

    await loadClient();

    expect(created).toHaveLength(1);
    expect(cachedClient()).toBeUndefined();
  });
});

describe('disconnectDb', () => {
  it('closes the client', async () => {
    const close = vi.fn(() => Promise.resolve());
    closeBehavior = close;
    const { disconnectDb } = await loadClient();

    await expect(disconnectDb()).resolves.toBeUndefined();

    expect(close).toHaveBeenCalledOnce();
  });

  it('logs a failed close once and rethrows it unchanged', async () => {
    const failure = new Error('pool stuck');
    closeBehavior = () => Promise.reject(failure);
    const { disconnectDb } = await loadClient();

    await expect(disconnectDb()).rejects.toBe(failure);

    expect(stderr).toHaveBeenCalledOnce();
    expect(JSON.parse(String(stderr.mock.calls[0]?.[0]))).toMatchObject({
      message: 'db.disconnect_failed',
      context: { module: 'infrastructure.prisma' },
      error: { message: 'pool stuck' },
    });
  });
});
