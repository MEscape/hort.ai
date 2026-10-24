import { describe, expect, it } from 'vitest';

import type { ClientAddressSettings } from '@lib/config/server';
import { createClientAddressProvider, createClientSubjectResolver } from '@lib/rate-limit';
import type { HeaderReader } from '@lib/rate-limit';

import { createFakeClock, createRecordingLog } from './fakes';

const vercelSettings: ClientAddressSettings = {
  source: 'vercel',
  configured: true,
  trustedProxies: [],
};
const noneSettings: ClientAddressSettings = {
  source: 'none',
  configured: true,
  trustedProxies: [],
};

const withAddress = (value: string): HeaderReader => ({
  get: (name) => (name === 'x-vercel-forwarded-for' ? value : null),
});
const withoutHeaders: HeaderReader = { get: () => null };

function setup(settings: ClientAddressSettings = vercelSettings, logIntervalMs?: number) {
  const clock = createFakeClock();
  const log = createRecordingLog();
  const resolver = createClientSubjectResolver({
    settings,
    clock,
    log,
    ...(logIntervalMs === undefined ? {} : { logIntervalMs }),
  });
  return { clock, log, resolver };
}

describe('createClientSubjectResolver', () => {
  it('turns a trusted address into a client subject and logs nothing', () => {
    const { resolver, log } = setup();

    expect(resolver.fromHeaders(withAddress('203.0.113.7'))).toEqual({
      kind: 'client',
      address: '203.0.113.7',
    });
    expect(log.entries).toEqual([]);
  });

  it('never guesses: an untrusted header gives an unresolved client and a warning with the reason only', () => {
    const { resolver, log } = setup();

    expect(resolver.fromHeaders(withoutHeaders)).toEqual({ kind: 'unresolved-client' });
    expect(log.entries).toEqual([
      {
        level: 'warn',
        message: 'rate_limit.client_unresolved',
        context: { reason: 'header_missing' },
      },
    ]);
  });

  it('logs an operator-chosen "none" at info level', () => {
    const { resolver, log } = setup(noneSettings);

    resolver.fromHeaders(withoutHeaders);

    expect(log.entries.map((entry) => entry.level)).toEqual(['info']);
    expect(log.entries[0]?.context).toEqual({ reason: 'source_disabled' });
  });

  it('reports a request-less call as no_request', () => {
    const { resolver, log } = setup();

    expect(resolver.withoutRequest()).toEqual({ kind: 'unresolved-client' });
    expect(log.entries[0]?.context).toEqual({ reason: 'no_request' });
  });

  it('writes one line per interval and reason, then reports how many it dropped', () => {
    const { resolver, log, clock } = setup();

    resolver.fromHeaders(withoutHeaders);
    resolver.fromHeaders(withoutHeaders);
    resolver.fromHeaders(withoutHeaders);
    resolver.withoutRequest();
    expect(log.entries).toHaveLength(2);

    clock.advance(10_000);
    resolver.fromHeaders(withoutHeaders);

    expect(log.entries).toHaveLength(3);
    expect(log.entries[2]?.context).toEqual({ reason: 'header_missing', suppressed: 2 });
  });

  it('honours a custom log interval', () => {
    const { resolver, log, clock } = setup(vercelSettings, 100);
    resolver.withoutRequest();
    clock.advance(100);

    resolver.withoutRequest();

    expect(log.entries).toHaveLength(2);
  });

  it('refuses unusable settings when it is built', () => {
    expect(() => setup({ source: 'proxies', configured: true, trustedProxies: [] })).toThrow(
      'at least one trusted proxy',
    );
  });
});

describe('createClientAddressProvider', () => {
  function providerWith(getHeaders: () => Promise<HeaderReader>) {
    const log = createRecordingLog();
    const provider = createClientAddressProvider({
      settings: vercelSettings,
      clock: createFakeClock(),
      log,
      getHeaders,
    });
    return { provider, log };
  }

  it('resolves the address of the current request', async () => {
    const { provider } = providerWith(() => Promise.resolve(withAddress('203.0.113.7')));

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.7' });
  });

  it('gives an unresolved client, and does not reject, outside a request', async () => {
    const { provider, log } = providerWith(() =>
      Promise.reject(new Error('headers() was called outside a request scope')),
    );

    expect(await provider.current()).toEqual({ kind: 'unresolved-client' });
    expect(log.entries[0]?.context).toEqual({ reason: 'no_request' });
  });

  it('reads the headers again on every call', async () => {
    let address = '203.0.113.7';
    const { provider } = providerWith(() => Promise.resolve(withAddress(address)));
    await provider.current();
    address = '203.0.113.8';

    expect(await provider.current()).toEqual({ kind: 'client', address: '203.0.113.8' });
  });
});
