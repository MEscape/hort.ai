import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

import { BetterAuthCurrentActorProvider } from '@modules/auth/infrastructure/better-auth/better-auth-current-actor-provider';
import type {
  SessionSnapshot,
  SessionSource,
} from '@modules/auth/infrastructure/better-auth/better-auth-session-source';

import type { Clock } from '@lib/clock';

import { TENANT } from '../fakes';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const MAX_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const clock: Clock = { now: () => NOW };

function session(overrides: Partial<SessionSnapshot['user']> & { createdAt?: Date } = {}) {
  const { createdAt = new Date(NOW.getTime() - 1000), ...user } = overrides;
  const snapshot: SessionSnapshot = {
    user: { id: 'parent-1', email: 'mara@example.org', emailVerified: true, ...user },
    session: { createdAt },
  };
  return snapshot;
}

function build(source: SessionSource, headers = new Headers()) {
  const seen: Headers[] = [];
  const provider = new BetterAuthCurrentActorProvider({
    sessions: {
      getSession: (input) => {
        seen.push(input.headers);
        return source.getSession(input);
      },
    },
    getHeaders: () => Promise.resolve(headers),
    sessionMaxLifetimeMs: MAX_LIFETIME_MS,
    clock,
    tenantId: TENANT,
  });
  return { provider, seen };
}

const sessionOf = (snapshot: SessionSnapshot | null): SessionSource => ({
  getSession: () => Promise.resolve(snapshot),
});

describe('BetterAuthCurrentActorProvider', () => {
  it('turns a valid session into a parent of the configured tenant', async () => {
    const { provider } = build(sessionOf(session()));

    const result = await provider.getCurrentActor();

    expect(result.isOk() && result.value).toEqual({
      id: 'parent-1',
      tenantId: 'default',
      roles: ['parent'],
    });
  });

  it('never takes the tenant from the request, whatever the request claims', async () => {
    const hostile = new Headers({
      'x-tenant': 'other',
      'x-tenant-id': 'other',
      'x-civo-tenant': 'other',
      cookie: 'tenant=other',
      host: 'other.example.org',
    });
    const { provider, seen } = build(sessionOf(session()), hostile);

    const result = await provider.getCurrentActor();

    expect(result.isOk() && result.value.tenantId).toBe('default');
    // The headers are read for the session lookup only; nothing else consults them.
    expect(seen).toEqual([hostile]);
  });

  it('treats a request without a session as signed out', async () => {
    const { provider } = build(sessionOf(null));

    const result = await provider.getCurrentActor();

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'unauthorized',
      code: 'auth.unauthenticated',
    });
  });

  it('treats a session of an unconfirmed address as signed out, whatever the provider issued', async () => {
    const { provider } = build(sessionOf(session({ emailVerified: false })));

    const result = await provider.getCurrentActor();

    expect(result.isErr() && result.error.code).toBe('auth.unauthenticated');
  });

  it('keeps a session below its maximum age and ends it at the ceiling, however active it is', async () => {
    const justInside = session({ createdAt: new Date(NOW.getTime() - MAX_LIFETIME_MS + 1) });
    const atCeiling = session({ createdAt: new Date(NOW.getTime() - MAX_LIFETIME_MS) });

    const inside = await build(sessionOf(justInside)).provider.getCurrentActor();
    const ended = await build(sessionOf(atCeiling)).provider.getCurrentActor();

    expect(inside.isOk()).toBe(true);
    expect(ended.isErr() && ended.error).toMatchObject({ code: 'auth.session_expired' });
  });

  it('reads a provider answer of "no valid session" as signed out', async () => {
    const { provider } = build({
      getSession: () => Promise.reject(new APIError('UNAUTHORIZED', { message: 'x' })),
    });

    const result = await provider.getCurrentActor();

    expect(result.isErr() && result.error.code).toBe('auth.unauthenticated');
  });

  it('reports a broken lookup as a failure, never as signed out or as an actor', async () => {
    const cause = new Error('connect ECONNREFUSED 10.0.0.5:5432');
    const { provider } = build({ getSession: () => Promise.reject(cause) });

    const result = await provider.getCurrentActor();

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.session_lookup_failed',
    });
    expect(result.isErr() && result.error.message).not.toContain('10.0.0.5');
  });

  it('reports a failure to read the request headers as a failed lookup', async () => {
    const provider = new BetterAuthCurrentActorProvider({
      sessions: sessionOf(session()),
      getHeaders: () => {
        throw new Error('outside a request');
      },
      sessionMaxLifetimeMs: MAX_LIFETIME_MS,
      clock,
      tenantId: TENANT,
    });

    const result = await provider.getCurrentActor();

    expect(result.isErr() && result.error.code).toBe('auth.session_lookup_failed');
  });
});
