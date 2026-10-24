import { describe, expect, it } from 'vitest';

import { UpstashRateLimitStore } from '@lib/rate-limit/upstash-rate-limit-store';

interface Call {
  readonly url: string;
  readonly body: string;
  readonly init: RequestInit;
}

/** The URL a `fetch` call was made to; the store only ever passes a string. */
const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : '';

/** A fake `fetch` that records its calls and answers with a fixed response. */
function fakeFetch(respond: () => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (input, init) => {
      calls.push({
        url: urlOf(input),
        body: typeof init?.body === 'string' ? init.body : '',
        init: init ?? {},
      });
      return Promise.resolve(respond());
    },
  };
}

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

function storeAnswering(respond: () => Response, restUrl = 'https://redis.example.org/') {
  const fake = fakeFetch(respond);
  const store = new UpstashRateLimitStore({
    restUrl,
    restToken: 'secret-token',
    timeoutMs: 1000,
    fetch: fake.fetch,
  });
  return { store, calls: fake.calls };
}

describe('UpstashRateLimitStore', () => {
  it('turns the script answer into hits and whole seconds left, rounded up', async () => {
    const { store } = storeAnswering(() => json({ result: [3, 1500] }));

    expect(await store.hit('auth.sign-in:client:abc', 60)).toEqual({
      hits: 3,
      retryAfterSeconds: 2,
    });
  });

  it('sends one authenticated EVAL per attempt to the endpoint without trailing slashes', async () => {
    const { store, calls } = storeAnswering(
      () => json({ result: [1, 60_000] }),
      'https://r.example.org//',
    );

    await store.hit('policy:global', 60);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://r.example.org');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer secret-token' });
    const body = JSON.parse(calls[0]?.body ?? '[]') as unknown[];
    expect(body[0]).toBe('EVAL');
    expect(body.slice(2)).toEqual([1, 'rate-limit:policy:global', 60]);
  });

  it('does not let the platform cache the request, and bounds it in time', async () => {
    const { store, calls } = storeAnswering(() => json({ result: [1, 0] }));

    await store.hit('k', 1);

    expect(calls[0]?.init.cache).toBe('no-store');
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects when Upstash answers with an HTTP error', async () => {
    const { store } = storeAnswering(() => json({ error: 'nope' }, 401));

    await expect(store.hit('k', 1)).rejects.toThrow('HTTP 401');
  });

  it.each([
    ['a script error', { error: 'ERR something' }],
    ['a result of the wrong length', { result: [1] }],
    ['a zero hit count', { result: [0, 100] }],
    ['a fractional hit count', { result: [1.5, 100] }],
    ['a negative time to live', { result: [1, -1] }],
    ['text instead of numbers', { result: ['1', '100'] }],
  ])('rejects %s', async (_name, body) => {
    const { store } = storeAnswering(() => json(body));

    await expect(store.hit('k', 1)).rejects.toThrow('unexpected shape');
  });

  it('propagates a network failure', async () => {
    const store = new UpstashRateLimitStore({
      restUrl: 'https://r.example.org',
      restToken: 't',
      timeoutMs: 1000,
      fetch: () => Promise.reject(new TypeError('network down')),
    });

    await expect(store.hit('k', 1)).rejects.toThrow('network down');
  });

  it('uses the platform fetch when none is injected', async () => {
    const calls: string[] = [];
    const platformFetch = globalThis.fetch;
    globalThis.fetch = (input) => {
      calls.push(urlOf(input));
      return Promise.resolve(json({ result: [1, 1000] }));
    };
    try {
      const store = new UpstashRateLimitStore({
        restUrl: 'https://p.example.org',
        restToken: 't',
        timeoutMs: 1000,
      });

      expect(await store.hit('k', 1)).toEqual({ hits: 1, retryAfterSeconds: 1 });
      expect(calls).toEqual(['https://p.example.org']);
    } finally {
      globalThis.fetch = platformFetch;
    }
  });
});
