import { describe, expect, it } from 'vitest';

import type { BetterAuthInstance } from '@modules/auth/infrastructure/better-auth/create-auth';
import { createAuthRouteHandlers } from '@modules/auth/infrastructure/better-auth/create-auth-route-handlers';

import { infrastructureError, rateLimitedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const ORIGIN = 'https://hortai.example';

/** What the provider's own handler would answer; the test only needs to know it was reached. */
function build(options: { isEnabled?: boolean; admit?: 'allow' | 'rate_limited' | 'broken' } = {}) {
  const reached: string[] = [];
  let admitted = 0;
  const auth = {
    handler: (request: Request) => {
      reached.push(new URL(request.url).pathname);
      return Promise.resolve(new Response('provider', { status: 200 }));
    },
  } as unknown as BetterAuthInstance;

  const handlers = createAuthRouteHandlers({
    isEnabled: options.isEnabled ?? true,
    getAuth: () => auth,
    admit: () => {
      admitted += 1;
      if (options.admit === 'rate_limited') {
        return errAsync(rateLimitedError('auth.rate_limited', 'Too many attempts.', 42));
      }
      if (options.admit === 'broken') {
        return errAsync(infrastructureError('auth.rate_limiter_failed', 'down'));
      }
      return okAsync(undefined);
    },
  });
  return { handlers, reached, admitted: () => admitted };
}

const get = (path: string) => new Request(`${ORIGIN}${path}`);
const post = (path: string) => new Request(`${ORIGIN}${path}`, { method: 'POST', body: '{}' });

describe('auth route handlers', () => {
  it('serves the emailed verification link after admitting it', async () => {
    const { handlers, reached, admitted } = build();

    const response = await handlers.GET(get('/api/auth/verify-email?token=abc'));

    expect(response.status).toBe(200);
    expect(reached).toEqual(['/api/auth/verify-email']);
    expect(admitted()).toBe(1);
  });

  it('serves the emailed reset link', async () => {
    const { handlers, reached } = build();

    const response = await handlers.GET(get('/api/auth/reset-password/some-token?callbackURL=/x'));

    expect(response.status).toBe(200);
    expect(reached).toEqual(['/api/auth/reset-password/some-token']);
  });

  it.each([
    ['sign-in over HTTP', post('/api/auth/sign-in/email')],
    ['sign-up over HTTP', post('/api/auth/sign-up/email')],
    ['a session read', get('/api/auth/get-session')],
    ['sign-out over HTTP', post('/api/auth/sign-out')],
    ['a link path used with POST', post('/api/auth/verify-email')],
    ['a look-alike path', get('/api/auth/verify-email/../get-session')],
    ['a reset request over HTTP', post('/api/auth/request-password-reset')],
  ])(
    'does not expose %s: it is reached in-process by the use cases only',
    async (_name, request) => {
      const { handlers, reached, admitted } = build();

      const response = await (request.method === 'GET'
        ? handlers.GET(request)
        : handlers.POST(request));

      expect(response.status).toBe(404);
      expect(reached).toEqual([]);
      expect(admitted()).toBe(0);
    },
  );

  it('answers 404 for everything while authentication is disabled', async () => {
    const { handlers, reached } = build({ isEnabled: false });

    const response = await handlers.GET(get('/api/auth/verify-email?token=abc'));

    expect(response.status).toBe(404);
    expect(reached).toEqual([]);
  });

  it('answers 429 with Retry-After and does not reach the provider when the budget is spent', async () => {
    const { handlers, reached } = build({ admit: 'rate_limited' });

    const response = await handlers.GET(get('/api/auth/verify-email?token=abc'));

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(reached).toEqual([]);
  });

  it('answers 503, without any detail, when the limiter itself fails', async () => {
    const { handlers, reached } = build({ admit: 'broken' });

    const response = await handlers.GET(get('/api/auth/verify-email?token=abc'));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
    expect(reached).toEqual([]);
  });
});
