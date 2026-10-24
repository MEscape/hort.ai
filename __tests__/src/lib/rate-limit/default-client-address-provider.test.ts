import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientAddressSettings } from '@lib/config/server';
import type { HeaderReader } from '@lib/rate-limit';

interface Written {
  readonly level: string;
  readonly message: string;
  readonly context: Record<string, unknown> | undefined;
}

const world = vi.hoisted(() => ({
  nowMs: 0,
  settingsReads: 0,
  settings: undefined as ClientAddressSettings | Error | undefined,
  written: [] as Written[],
}));

vi.mock('@lib/clock', () => ({ systemClock: { now: () => new Date(world.nowMs) } }));
vi.mock('@lib/config/server', () => ({
  serverEnv: {},
  resolveRateLimitSettings: () => {
    world.settingsReads += 1;
    if (world.settings instanceof Error) {
      throw world.settings;
    }
    return { clientAddress: world.settings };
  },
}));
vi.mock('@lib/logger', () => {
  const write =
    (level: string, base: Record<string, unknown>) =>
    (message: string, ...rest: unknown[]) => {
      const context = rest[rest.length - 1] as Record<string, unknown> | undefined;
      world.written.push({ level, message, context: { ...base, ...context } });
    };
  return {
    logger: {
      withContext: (base: Record<string, unknown>) => ({
        info: write('info', base),
        warn: write('warn', base),
        error: write('error', base),
      }),
    },
  };
});

const vercel: ClientAddressSettings = { source: 'vercel', configured: true, trustedProxies: [] };
const withAddress = (value: string): HeaderReader => ({
  get: (name) => (name === 'x-vercel-forwarded-for' ? value : null),
});

async function load() {
  vi.resetModules();
  const mod = await import('@lib/rate-limit');
  return mod.getClientAddressProvider;
}

beforeEach(() => {
  world.nowMs = Date.UTC(2026, 9, 24, 10, 0, 0);
  world.settingsReads = 0;
  world.settings = vercel;
  world.written = [];
});

describe('getClientAddressProvider', () => {
  it('reads no configuration until an address is needed', async () => {
    const getClientAddressProvider = await load();

    getClientAddressProvider(() => Promise.resolve(withAddress('203.0.113.7')));

    expect(world.settingsReads).toBe(0);
  });

  it('resolves the client from the trusted headers of the current request', async () => {
    const getClientAddressProvider = await load();
    const provider = getClientAddressProvider(() => Promise.resolve(withAddress('203.0.113.7')));

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
  });

  it('builds one resolver for every provider and request', async () => {
    const getClientAddressProvider = await load();
    const headers = () => Promise.resolve(withAddress('203.0.113.7'));

    await getClientAddressProvider(headers).current();
    await getClientAddressProvider(headers).current();
    await getClientAddressProvider(() => Promise.reject(new Error('no request'))).current();

    expect(world.settingsReads).toBe(1);
  });

  it('gives an unresolved client outside a request', async () => {
    const getClientAddressProvider = await load();
    const provider = getClientAddressProvider(() => Promise.reject(new Error('no request')));

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(world.written).toEqual([
      {
        level: 'warn',
        message: 'rate_limit.client_unresolved',
        context: { module: 'rate-limit', reason: 'no_request' },
      },
    ]);
  });
});

describe('getClientAddressProvider with unusable configuration', () => {
  it('never guesses: every address is unresolved and the failure is logged once as an error', async () => {
    world.settings = new Error('bad proxy list');
    const getClientAddressProvider = await load();
    const provider = getClientAddressProvider(() => Promise.resolve(withAddress('203.0.113.7')));
    const outsideRequest = getClientAddressProvider(() => Promise.reject(new Error('no request')));

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(await outsideRequest.current()).toEqual({ kind: 'unresolved-client' });

    expect(world.written).toEqual([
      {
        level: 'error',
        message: 'rate_limit.client_unresolved',
        context: { module: 'rate-limit', reason: 'misconfigured' },
      },
    ]);
    expect(world.settingsReads).toBe(1);
  });

  it('tries again after a few seconds and recovers once the configuration is fixed', async () => {
    world.settings = new Error('bad proxy list');
    const getClientAddressProvider = await load();
    const provider = getClientAddressProvider(() => Promise.resolve(withAddress('203.0.113.7')));
    await provider.current();

    world.settings = vercel;
    world.nowMs += 5000;

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
    expect(world.settingsReads).toBe(2);
  });
});
