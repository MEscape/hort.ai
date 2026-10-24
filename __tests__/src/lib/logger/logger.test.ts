import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogLevel } from '@lib/logger';

interface Line {
  level: string;
  message: string;
  timestamp: string;
  context?: unknown;
  error?: { name: string; message: string; stack?: string };
}

const NOW = new Date('2026-03-04T05:06:07.000Z');

let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;

/** The logger reads `LOG_LEVEL` once on import, so each level needs a fresh module. */
async function loadLogger(level: LogLevel = 'debug') {
  vi.resetModules();
  vi.stubEnv('LOG_LEVEL', level);
  return (await import('@lib/logger')).logger;
}

function lines(sink: ReturnType<typeof vi.spyOn>): Line[] {
  return sink.mock.calls.map((call: unknown[]) => JSON.parse(String(call[0])) as Line);
}

/** The context of the one line `logger.info` wrote, as the sink received it. */
async function contextOf(context: Record<string, unknown>): Promise<unknown> {
  const logger = await loadLogger();
  logger.info('m', context);
  return lines(stdout)[0]?.context;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('logger levels', () => {
  it('writes debug, info and warn to stdout and error to stderr', async () => {
    const logger = await loadLogger('debug');

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e', new Error('x'));

    expect(lines(stdout).map((line) => line.level)).toEqual(['debug', 'info', 'warn']);
    expect(lines(stderr).map((line) => line.level)).toEqual(['error']);
  });

  it('stamps each line with the current time', async () => {
    const logger = await loadLogger();

    logger.info('hello');

    expect(lines(stdout)[0]).toMatchObject({ message: 'hello', timestamp: NOW.toISOString() });
  });

  it.each([
    ['debug', ['debug', 'info', 'warn', 'error']],
    ['info', ['info', 'warn', 'error']],
    ['warn', ['warn', 'error']],
    ['error', ['error']],
  ] as const)('with LOG_LEVEL=%s drops everything below it', async (level, expected) => {
    const logger = await loadLogger(level);

    logger.debug('m');
    logger.info('m');
    logger.warn('m');
    logger.error('m', 'boom');

    const all = [...lines(stdout), ...lines(stderr)].map((line) => line.level);
    expect(all.sort()).toEqual([...expected].sort());
  });
});

describe('logger.withContext', () => {
  it('binds context to every call and lets the call add or override it', async () => {
    const logger = (await loadLogger()).withContext({ module: 'm', requestId: 'r1' });

    logger.debug('d');
    logger.info('i', { userId: 'u' });
    logger.warn('w', { module: 'other' });
    logger.error('e', new Error('x'), { extra: 1 });

    expect(lines(stdout).map((line) => line.context)).toEqual([
      { module: 'm', requestId: 'r1' },
      { module: 'm', requestId: 'r1', userId: 'u' },
      { module: 'other', requestId: 'r1' },
    ]);
    expect(lines(stderr)[0]?.context).toEqual({ module: 'm', requestId: 'r1', extra: 1 });
  });
});

describe('logger error normalization', () => {
  it('keeps name, message and stack of an Error', async () => {
    const logger = await loadLogger();
    const error = new TypeError('bad');

    logger.error('failed', error);

    expect(lines(stderr)[0]?.error).toEqual({
      name: 'TypeError',
      message: 'bad',
      stack: error.stack,
    });
  });

  it('names an AppError by kind and code and borrows the stack of an Error cause', async () => {
    const logger = await loadLogger();
    const cause = new Error('db');

    logger.error('failed', { kind: 'infrastructure', code: 'db.failed', cause });
    logger.error('failed', { kind: 'not_found', code: 'x.missing', cause: 'text' });

    expect(lines(stderr).map((line) => line.error)).toEqual([
      { name: 'infrastructure', message: 'db.failed', stack: cause.stack },
      { name: 'not_found', message: 'x.missing' },
    ]);
  });

  it('describes anything else as an UnknownError', async () => {
    const logger = await loadLogger();

    logger.error('a', 'plain text');
    logger.error('b', { kind: 'only-kind' });
    logger.error('c', null);

    expect(lines(stderr).map((line) => line.error)).toEqual([
      { name: 'UnknownError', message: 'plain text' },
      { name: 'UnknownError', message: '[object Object]' },
      { name: 'UnknownError', message: 'null' },
    ]);
  });

  it('survives a value that cannot be converted to text', async () => {
    const logger = await loadLogger();

    logger.error('failed', Object.create(null));

    expect(lines(stderr)[0]?.error).toEqual({
      name: 'UnknownError',
      message: '[unprintable value]',
    });
  });
});

describe('logger redaction', () => {
  it.each([
    'password',
    'newPassword',
    'passwd',
    'passphrase',
    'accessToken',
    'x-api-key',
    'API_KEY',
    'apikey',
    'private_key',
    'Authorization',
    'Set-Cookie',
    'AUTH_SECRET',
    'creditCard',
    'cvv',
  ])('redacts the key %s', async (key) => {
    expect(await contextOf({ [key]: 'hunter2', safe: 'visible' })).toEqual({
      [key]: '[REDACTED]',
      safe: 'visible',
    });
  });

  it('redacts at any depth, also inside arrays', async () => {
    expect(await contextOf({ user: { profile: [{ token: 't', name: 'n' }] } })).toEqual({
      user: { profile: [{ token: '[REDACTED]', name: 'n' }] },
    });
  });

  it('writes a bigint as text', async () => {
    expect(await contextOf({ big: 12n })).toEqual({ big: '12' });
  });

  it('writes a Date as ISO text and an invalid Date as such', async () => {
    expect(
      await contextOf({ at: new Date('2026-01-02T03:04:05.000Z'), bad: new Date('nope') }),
    ).toEqual({ at: '2026-01-02T03:04:05.000Z', bad: 'Invalid Date' });
  });

  it('keeps other class instances recognizable without looking inside', async () => {
    class Opaque {
      toString() {
        return 'opaque!';
      }
    }

    expect(await contextOf({ value: new Opaque(), map: new Map([['password', 'x']]) })).toEqual({
      value: 'opaque!',
      map: '[object Map]',
    });
  });

  it('accepts an object without prototype', async () => {
    expect(await contextOf({ bare: Object.assign(Object.create(null), { a: 1 }) })).toEqual({
      bare: { a: 1 },
    });
  });

  it('cuts a cycle but keeps an object referenced twice', async () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic['self'] = cyclic;
    const shared = { v: 1 };

    expect(await contextOf({ cyclic, a: shared, b: shared })).toEqual({
      cyclic: { name: 'loop', self: '[Circular]' },
      a: { v: 1 },
      b: { v: 1 },
    });
  });

  it('cuts over-deep nesting', async () => {
    let deep: Record<string, unknown> = { end: true };
    for (let level = 0; level < 12; level += 1) {
      deep = { next: deep };
    }

    expect(JSON.stringify(await contextOf({ deep }))).toContain('"[Truncated]"');
  });

  it('replaces a context that cannot be serialized instead of throwing', async () => {
    const hostile = {
      get boom(): string {
        throw new Error('getter');
      },
    };

    expect(await contextOf(hostile)).toBe('[Unserializable]');
  });

  it('omits the context when there is none', async () => {
    const logger = await loadLogger();

    logger.info('plain');

    expect(lines(stdout)[0]).not.toHaveProperty('context');
  });
});
