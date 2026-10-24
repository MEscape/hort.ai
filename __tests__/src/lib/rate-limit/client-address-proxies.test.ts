import { describe, expect, it } from 'vitest';

import { createClientAddressResolver } from '@lib/rate-limit';
import type { ClientAddress, UnresolvedReason } from '@lib/rate-limit';

function resolverFor(trustedProxies: readonly string[]) {
  const resolve = createClientAddressResolver({
    source: 'proxies',
    configured: true,
    trustedProxies,
  });
  return (forwardedFor: string | null): ClientAddress =>
    resolve({ get: (name) => (name.toLowerCase() === 'x-forwarded-for' ? forwardedFor : null) });
}

const resolved = (address: string): ClientAddress => ({ status: 'resolved', address });
const unresolved = (reason: UnresolvedReason): ClientAddress => ({
  status: 'unresolved',
  reason,
});

describe('createClientAddressResolver with source "proxies"', () => {
  const resolve = resolverFor([
    '10.0.0.0/8',
    '192.0.2.1',
    '2001:db8:aaaa::/48',
    '2001:db8:bbbb::1',
  ]);

  it('takes the first hop from the right that is not a trusted proxy', () => {
    expect(resolve('203.0.113.7, 10.0.0.1, 192.0.2.1')).toEqual(resolved('203.0.113.7'));
  });

  it('never trusts what the client wrote on the left', () => {
    expect(resolve('1.2.3.4, 203.0.113.7, 10.0.0.1')).toEqual(resolved('203.0.113.7'));
  });

  it('does not read, and so is not confused by, garbage left of the client hop', () => {
    expect(resolve('garbage,,,;;;, 203.0.113.7, 10.0.0.1')).toEqual(resolved('203.0.113.7'));
  });

  it('resolves the only hop when it is not a trusted proxy', () => {
    expect(resolve('203.0.113.7')).toEqual(resolved('203.0.113.7'));
  });

  it('skips empty hops between and after commas', () => {
    expect(resolve('203.0.113.7,,10.0.0.1,')).toEqual(resolved('203.0.113.7'));
    expect(resolve(' 203.0.113.7 , 10.0.0.1 ')).toEqual(resolved('203.0.113.7'));
  });

  it('trusts IPv6 ranges and single addresses', () => {
    expect(resolve('203.0.113.7, 2001:db8:aaaa:1::9, 2001:db8:bbbb::1')).toEqual(
      resolved('203.0.113.7'),
    );
  });

  it('does not trust an IPv6 neighbour of a trusted single address', () => {
    expect(resolve('2001:db8:bbbb::2')).toEqual(
      resolved('2001:0db8:bbbb:0000:0000:0000:0000:0000'),
    );
  });

  it('counts an IPv6 client by its /64', () => {
    expect(resolve('2001:db8:1:2:3:4:5:6, 10.0.0.1')).toEqual(
      resolved('2001:0db8:0001:0002:0000:0000:0000:0000'),
    );
  });

  it('compares an IPv4-mapped hop in its IPv4 form', () => {
    expect(resolve('203.0.113.7, ::ffff:10.0.0.1')).toEqual(resolved('203.0.113.7'));
    expect(resolve('::ffff:203.0.113.7, 10.0.0.1')).toEqual(resolved('203.0.113.7'));
  });

  it('reports every hop being a trusted proxy', () => {
    expect(resolve('10.0.0.2, 10.0.0.1')).toEqual(unresolved('no_untrusted_hop'));
  });

  it.each([null, '', '  ', ' , , '])('reports a missing header for %j', (value) => {
    expect(resolve(value)).toEqual(unresolved('header_missing'));
  });

  it('distrusts the whole header when a hop met on the way is malformed', () => {
    expect(resolve('203.0.113.7, not-an-ip, 10.0.0.1')).toEqual(unresolved('header_malformed'));
    expect(resolve('203.0.113.7, 10.0.0.1, not-an-ip')).toEqual(unresolved('header_malformed'));
  });

  it('copes with a very long header by reading only as far as the client', () => {
    const left = '1.1.1.1,'.repeat(100_000);

    expect(resolve(`${left}203.0.113.7, 10.0.0.1`)).toEqual(resolved('203.0.113.7'));
  });
});

describe('createClientAddressResolver trusted proxy list', () => {
  const settings = (trustedProxies: readonly string[]) => ({
    source: 'proxies' as const,
    configured: true,
    trustedProxies,
  });

  it('refuses the proxies source without a trusted proxy', () => {
    expect(() => createClientAddressResolver(settings([]))).toThrow('at least one trusted proxy');
  });

  it.each(['not-an-ip', '10.0.0.0/', '10.0.0.0/x', '10.0.0.0/8/8', '', '/8'])(
    'refuses the malformed entry %j',
    (entry) => {
      expect(() => createClientAddressResolver(settings([entry]))).toThrow(
        'Invalid trusted proxy entry.',
      );
    },
  );

  it('refuses an IPv4-mapped range, which would silently match nothing', () => {
    expect(() => createClientAddressResolver(settings(['::ffff:10.0.0.0/104']))).toThrow(
      'Write an IPv4-mapped trusted proxy range as plain IPv4.',
    );
  });

  it('accepts a single IPv4-mapped address and trusts it as plain IPv4', () => {
    const resolve = resolverFor(['::ffff:10.0.0.1']);

    expect(resolve('203.0.113.7, 10.0.0.1')).toEqual(resolved('203.0.113.7'));
    expect(resolve('10.0.0.2, 10.0.0.1')).toEqual(resolved('10.0.0.2'));
  });
});
