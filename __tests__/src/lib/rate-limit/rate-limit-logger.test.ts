import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRateLimitLog } from '@lib/rate-limit/rate-limit-logger';

interface Written {
  readonly level: string;
  readonly message: string;
  readonly error?: unknown;
  readonly context: Record<string, unknown> | undefined;
}

const written = vi.hoisted((): Written[] => []);

// The shared logger writes to the console; a fake that remembers what it was given is enough here.
vi.mock('@lib/logger', () => ({
  logger: {
    withContext: (base: Record<string, unknown>) => ({
      info: (message: string, context?: Record<string, unknown>) => {
        written.push({ level: 'info', message, context: { ...base, ...context } });
      },
      warn: (message: string, context?: Record<string, unknown>) => {
        written.push({ level: 'warn', message, context: { ...base, ...context } });
      },
      error: (message: string, error: unknown, context?: Record<string, unknown>) => {
        written.push({ level: 'error', message, error, context: { ...base, ...context } });
      },
    }),
  },
}));

beforeEach(() => {
  written.length = 0;
});

describe('createRateLimitLog', () => {
  it('writes info and warn lines for the rate-limit module with the given context', () => {
    const log = createRateLimitLog();

    log.info('rate_limit.rejected', { policy: 'auth.sign-in' });
    log.warn('rate_limit.failed_open', {
      policy: 'content.view',
      reason: 'timeout',
      suppressed: 3,
    });

    expect(written).toEqual([
      {
        level: 'info',
        message: 'rate_limit.rejected',
        context: { module: 'rate-limit', policy: 'auth.sign-in' },
      },
      {
        level: 'warn',
        message: 'rate_limit.failed_open',
        context: { module: 'rate-limit', policy: 'content.view', reason: 'timeout', suppressed: 3 },
      },
    ]);
  });

  it('writes an error line with the error that caused it', () => {
    const cause = new Error('down');

    createRateLimitLog().error('rate_limit.backend_failed', cause, { reason: 'store_error' });

    expect(written).toEqual([
      {
        level: 'error',
        message: 'rate_limit.backend_failed',
        error: cause,
        context: { module: 'rate-limit', reason: 'store_error' },
      },
    ]);
  });

  it('works without a context', () => {
    const log = createRateLimitLog();

    log.info('a');
    log.warn('b');
    log.error('c', 'oops');

    expect(written.map((line) => line.context)).toEqual([
      { module: 'rate-limit' },
      { module: 'rate-limit' },
      { module: 'rate-limit' },
    ]);
  });
});
