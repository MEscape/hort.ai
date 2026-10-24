import { describe, expect, it } from 'vitest';

import { createClientAddressResolver } from '@lib/rate-limit';
import type { ClientAddress, HeaderReader, UnresolvedReason } from '@lib/rate-limit';

function headersOf(values: Record<string, string>): HeaderReader {
  return { get: (name) => values[name.toLowerCase()] ?? null };
}

const vercel = createClientAddressResolver({
  source: 'vercel',
  configured: true,
  trustedProxies: [],
});

function fromVercel(value?: string): ClientAddress {
  return vercel(headersOf(value === undefined ? {} : { 'x-vercel-forwarded-for': value }));
}

const resolved = (address: string): ClientAddress => ({ status: 'resolved', address });
const unresolved = (reason: UnresolvedReason): ClientAddress => ({
  status: 'unresolved',
  reason,
});

describe('createClientAddressResolver with source "none"', () => {
  it("resolves nothing, and says it was the operator's choice when configured", () => {
    const resolve = createClientAddressResolver({
      source: 'none',
      configured: true,
      trustedProxies: [],
    });

    expect(resolve(headersOf({ 'x-forwarded-for': '203.0.113.7' }))).toEqual(
      unresolved('source_disabled'),
    );
  });

  it('flags a source that was only never configured', () => {
    const resolve = createClientAddressResolver({
      source: 'none',
      configured: false,
      trustedProxies: [],
    });

    expect(resolve(headersOf({}))).toEqual(unresolved('source_not_configured'));
  });
});

describe('createClientAddressResolver with source "vercel"', () => {
  it('uses the single address of the platform header', () => {
    expect(fromVercel('203.0.113.7')).toEqual(resolved('203.0.113.7'));
    expect(fromVercel('  203.0.113.7  ')).toEqual(resolved('203.0.113.7'));
  });

  it('ignores x-forwarded-for, which a client can write', () => {
    const result = vercel(headersOf({ 'x-forwarded-for': '203.0.113.7' }));

    expect(result).toEqual(unresolved('header_missing'));
  });

  it.each([undefined, '', '  ', ' , '])('reports a missing header for %j', (value) => {
    expect(fromVercel(value)).toEqual(unresolved('header_missing'));
  });

  it('distrusts a header with more than one address', () => {
    expect(fromVercel('203.0.113.7, 198.51.100.1')).toEqual(unresolved('ambiguous_header'));
  });

  it.each(['not-an-ip', '203.0.113.256', '203.0.113.7:8080', '2001:db8::zz'])(
    'distrusts the malformed address %j',
    (value) => {
      expect(fromVercel(value)).toEqual(unresolved('header_malformed'));
    },
  );

  it('counts an IPv6 client by its /64 network, in canonical form', () => {
    expect(fromVercel('2001:DB8:1:2:3:4:5:6')).toEqual(
      resolved('2001:0db8:0001:0002:0000:0000:0000:0000'),
    );
  });

  it('puts every address of one /64 on the same key', () => {
    expect(fromVercel('2001:db8:0:1::1')).toEqual(fromVercel('2001:db8:0:1:ffff:ffff:ffff:ffff'));
    expect(fromVercel('2001:db8:0:1::1')).not.toEqual(fromVercel('2001:db8:0:2::1'));
  });

  it.each([
    ['2001:db8::1', '2001:0db8:0000:0000:0000:0000:0000:0000'],
    ['::', '0000:0000:0000:0000:0000:0000:0000:0000'],
    ['1::', '0001:0000:0000:0000:0000:0000:0000:0000'],
    ['::1', '0000:0000:0000:0000:0000:0000:0000:0000'],
    ['fe80::1%eth0', 'fe80:0000:0000:0000:0000:0000:0000:0000'],
    ['64:ff9b::192.0.2.1', '0064:ff9b:0000:0000:0000:0000:0000:0000'],
  ])('expands the IPv6 form %s', (value, expected) => {
    expect(fromVercel(value)).toEqual(resolved(expected));
  });

  it.each(['::ffff:203.0.113.7', '::ffff:cb00:7107', '0:0:0:0:0:FFFF:cb00:7107'])(
    'treats the IPv4-mapped form %s as the IPv4 client',
    (value) => {
      expect(fromVercel(value)).toEqual(resolved('203.0.113.7'));
    },
  );

  it('does not mistake a non-zero prefix for an IPv4-mapped address', () => {
    expect(fromVercel('1::ffff:cb00:7107')).toEqual(
      resolved('0001:0000:0000:0000:0000:0000:0000:0000'),
    );
  });
});
