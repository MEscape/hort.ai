import { BlockList, isIP } from 'node:net';

import type { ClientAddressSettings } from '@lib/config/server';

/** The part of `Headers` the resolver reads, so tests and adapters need not build a real one. */
export interface HeaderReader {
  get(name: string): string | null;
}

/** Why no trustworthy client address could be determined. Safe to log. */
export type UnresolvedReason =
  /** The source is `none` by the operator's choice. */
  | 'source_disabled'
  /** The source is `none` only because nothing was configured or detected: likely an oversight. */
  | 'source_not_configured'
  /** The header the source relies on is absent (running outside the trusted platform or proxy). */
  | 'header_missing'
  /** A hop is not an IP address. The whole header is distrusted, not partly used. */
  | 'header_malformed'
  /** More than one address where the platform sets exactly one. */
  | 'ambiguous_header'
  /** Every hop is a trusted proxy, so none of them is the client. */
  | 'no_untrusted_hop'
  /** There is no request to read (build time, a background job, a test). */
  | 'no_request';

export type ClientAddress =
  | { readonly status: 'resolved'; readonly address: string }
  | { readonly status: 'unresolved'; readonly reason: UnresolvedReason };

const VERCEL_HEADER = 'x-vercel-forwarded-for';
const FORWARDED_FOR_HEADER = 'x-forwarded-for';

const IPV6_GROUPS = 8;
const IPV6_GROUP_WIDTH = 4;
const IPV6_SUBNET_GROUPS = 4; // /64
const HEX = 16;
const BYTE = 256;
const FAMILY_V4 = 4;
const FAMILY_V6 = 6;
const IPV4_MAPPED_PREFIX_GROUPS = 5;
const IPV4_MAPPED_MARKER = 'ffff';
const ZERO_GROUP = '0000';
const CIDR_PREFIX_PATTERN = /^\d+$/;

interface ParsedIp {
  readonly family: typeof FAMILY_V4 | typeof FAMILY_V6;
  /** Dotted IPv4, or the eight lower-case 4-digit groups of an IPv6 address. */
  readonly canonical: string;
}

/** Expands any valid IPv6 text (compressed, zone id, embedded IPv4 tail) to eight 4-digit groups. */
function expandIpv6(text: string): string[] {
  let source = text.toLowerCase();
  const zone = source.indexOf('%');
  if (zone !== -1) {
    source = source.slice(0, zone);
  }

  const lastColon = source.lastIndexOf(':');
  const tail = source.slice(lastColon + 1);
  if (tail.includes('.')) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split('.').map(Number);
    const high = (a * BYTE + b).toString(HEX);
    const low = (c * BYTE + d).toString(HEX);
    source = `${source.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const [head = '', rest] = source.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = rest === undefined || rest === '' ? [] : rest.split(':');
  const zeros = rest === undefined ? 0 : IPV6_GROUPS - left.length - right.length;

  return [...left, ...Array.from({ length: zeros }, () => '0'), ...right].map((group) =>
    group.padStart(IPV6_GROUP_WIDTH, '0'),
  );
}

function parseIp(text: string): ParsedIp | null {
  const family = isIP(text);
  if (family === FAMILY_V4) {
    return { family: FAMILY_V4, canonical: text };
  }
  if (family !== FAMILY_V6) {
    return null;
  }

  const groups = expandIpv6(text);
  const isMappedV4 =
    groups.slice(0, IPV4_MAPPED_PREFIX_GROUPS).every((group) => group === ZERO_GROUP) &&
    groups[IPV4_MAPPED_PREFIX_GROUPS] === IPV4_MAPPED_MARKER;
  if (isMappedV4) {
    const [high = ZERO_GROUP, low = ZERO_GROUP] = groups.slice(IPV4_MAPPED_PREFIX_GROUPS + 1);
    const octets = [high.slice(0, 2), high.slice(2), low.slice(0, 2), low.slice(2)];
    return { family: FAMILY_V4, canonical: octets.map((octet) => parseInt(octet, HEX)).join('.') };
  }
  return { family: FAMILY_V6, canonical: groups.join(':') };
}

/**
 * The key an address is counted under. An IPv4-mapped IPv6 address is the same client as its
 * IPv4 form. An IPv6 address is reduced to its /64 network: one subscriber commonly controls
 * the whole /64, so counting single addresses would let a client rotate through billions of
 * them. The result matches the normalisation Better Auth applies to its own IP limits.
 */
function normalise(parsed: ParsedIp): string {
  if (parsed.family === FAMILY_V4) {
    return parsed.canonical;
  }
  return [
    ...parsed.canonical.split(':').slice(0, IPV6_SUBNET_GROUPS),
    ...Array.from({ length: IPV6_GROUPS - IPV6_SUBNET_GROUPS }, () => ZERO_GROUP),
  ].join(':');
}

function addTrustedProxy(list: BlockList, entry: string): void {
  const slash = entry.lastIndexOf('/');
  const addressText = slash === -1 ? entry : entry.slice(0, slash);
  const prefixText = slash === -1 ? undefined : entry.slice(slash + 1);
  const parsed = parseIp(addressText);

  // Configuration is validated at startup; reaching a throw here means that was bypassed.
  if (parsed === null || (prefixText !== undefined && !CIDR_PREFIX_PATTERN.test(prefixText))) {
    throw new Error('Invalid trusted proxy entry.');
  }
  if (prefixText !== undefined && isIP(addressText) === FAMILY_V6 && parsed.family === FAMILY_V4) {
    // Hops are compared in their IPv4 form, so a range written for the mapped form would
    // silently match nothing. Refuse it instead.
    throw new Error('Write an IPv4-mapped trusted proxy range as plain IPv4.');
  }

  const type = parsed.family === FAMILY_V4 ? 'ipv4' : 'ipv6';
  const address = parsed.family === FAMILY_V4 ? parsed.canonical : compressForBlockList(parsed);
  if (prefixText === undefined) {
    list.addAddress(address, type);
  } else {
    list.addSubnet(address, Number(prefixText), type);
  }
}

function buildTrustedProxyList(entries: readonly string[]): BlockList {
  const list = new BlockList();
  for (const entry of entries) {
    addTrustedProxy(list, entry);
  }
  return list;
}

/** `BlockList` takes ordinary IPv6 text, not the zero-padded groups used internally. */
function compressForBlockList(parsed: ParsedIp): string {
  return parsed.canonical
    .split(':')
    .map((group) => parseInt(group, HEX).toString(HEX))
    .join(':');
}

function isTrusted(list: BlockList, parsed: ParsedIp): boolean {
  return parsed.family === FAMILY_V4
    ? list.check(parsed.canonical, 'ipv4')
    : list.check(compressForBlockList(parsed), 'ipv6');
}

function splitHops(value: string): string[] {
  return value
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
}

/**
 * Builds the function that turns request headers into a client address.
 *
 * Trust is explicit and narrow; there is no mode that believes an arbitrary header:
 *
 * - `vercel`: only `x-vercel-forwarded-for`, which Vercel's edge sets itself (a value sent by
 *   the client does not reach the app). Exactly one address is accepted.
 * - `proxies`: `x-forwarded-for` read from the right, skipping hops that are in
 *   `trustedProxies`; the first hop that is not one of them is the client. The left-most entry
 *   is never used on its own, because the client controls it, and nothing to the left of the
 *   client hop is read at all. A malformed hop met on the way (before the client is found)
 *   distrusts the whole header. This is only sound if the app is reachable solely through those
 *   proxies.
 * - `none`: nothing is resolved.
 *
 * Throws on a malformed trusted-proxy list or a `proxies` source without one; configuration
 * validation reports both at startup, so this is a backstop.
 */
export function createClientAddressResolver(
  settings: ClientAddressSettings,
): (headers: HeaderReader) => ClientAddress {
  const unresolved = (reason: UnresolvedReason): ClientAddress => ({
    status: 'unresolved',
    reason,
  });

  function fromPlatformHeader(headers: HeaderReader): ClientAddress {
    const hops = splitHops(headers.get(VERCEL_HEADER) ?? '');
    const [only] = hops;
    if (only === undefined) {
      return unresolved('header_missing');
    }
    if (hops.length > 1) {
      return unresolved('ambiguous_header');
    }
    const parsed = parseIp(only);
    return parsed === null
      ? unresolved('header_malformed')
      : { status: 'resolved', address: normalise(parsed) };
  }

  function fromForwardedFor(
    headers: HeaderReader,
    trusted: ReturnType<typeof buildTrustedProxyList>,
  ): ClientAddress {
    const value = headers.get(FORWARDED_FOR_HEADER);
    if (value === null) {
      return unresolved('header_missing');
    }

    // Walk from the right end, one hop at a time, without splitting the rest. The left of this
    // header is written by the client, so its length is the attacker's to choose: the cost here
    // stays proportional to the trusted hops plus one. And never turn the length or content of
    // the left into "unresolved": with the default `skip` mode that would mean "not limited".
    let end = value.length;
    let sawHop = false;
    while (end > 0) {
      const comma = value.lastIndexOf(',', end - 1);
      const hop = value.slice(comma + 1, end).trim();
      end = comma === -1 ? 0 : comma;
      if (hop.length === 0) {
        continue;
      }
      sawHop = true;

      const parsed = parseIp(hop);
      if (parsed === null) {
        return unresolved('header_malformed');
      }
      if (isTrusted(trusted, parsed)) {
        continue;
      }
      return { status: 'resolved', address: normalise(parsed) };
    }
    return unresolved(sawHop ? 'no_untrusted_hop' : 'header_missing');
  }

  switch (settings.source) {
    case 'none':
      return () => unresolved(settings.configured ? 'source_disabled' : 'source_not_configured');
    case 'vercel':
      return fromPlatformHeader;
    case 'proxies': {
      if (settings.trustedProxies.length === 0) {
        throw new Error('The "proxies" source needs at least one trusted proxy.');
      }
      const trusted = buildTrustedProxyList(settings.trustedProxies);
      return (headers) => fromForwardedFor(headers, trusted);
    }
  }
}
