import { describe, expect, it } from 'vitest';

import { GetAllTenantsAuditTrail } from '@modules/audit/application/queries/get-all-tenants-audit-trail';
import { GetAuditDigest } from '@modules/audit/application/queries/get-audit-digest';
import { GetAuditTrail } from '@modules/audit/application/queries/get-audit-trail';
import { EMPTY_AUDIT_FILTER } from '@modules/audit/domain/models/audit-filter';

import { STORE_DOWN, TENANT, clock, fakeRepository, stored } from '../fakes';

describe('GetAuditTrail', () => {
  it('reads exactly one tenant: the scope is the tenant it was asked for', async () => {
    const entries = fakeRepository({ items: [stored()] });

    const result = await new GetAuditTrail({ entries, clock }).execute(
      'default',
      EMPTY_AUDIT_FILTER,
    );

    expect(result.isOk()).toBe(true);
    expect(entries.calls.listed.map((call) => call.scope)).toEqual([
      { kind: 'tenant', tenantId: 'default' },
    ]);
    expect(entries.calls.counted.map((call) => call.scope)).toEqual([
      { kind: 'tenant', tenantId: 'default' },
    ]);
    expect(entries.calls.memberLookups.map((call) => call.scope)).toEqual([
      { kind: 'tenant', tenantId: 'default' },
    ]);
  });

  it('ignores a tenant that the filter names: a tenant reads its own trail only', async () => {
    const entries = fakeRepository();

    await new GetAuditTrail({ entries, clock }).execute('default', {
      ...EMPTY_AUDIT_FILTER,
      tenantId: 'another-tenant',
    });

    expect(entries.calls.listed.map((call) => call.scope)).toEqual([
      { kind: 'tenant', tenantId: 'default' },
    ]);
  });

  it('refuses a missing tenant instead of reading everyone: no query reaches the store', async () => {
    const entries = fakeRepository();

    const result = await new GetAuditTrail({ entries, clock }).execute('', EMPTY_AUDIT_FILTER);

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { tenantId: ['audit.validation.id_invalid'] },
    });
    expect(entries.calls.listed).toEqual([]);
  });

  it('refuses a member filter that is not an id, without reaching the store', async () => {
    const entries = fakeRepository();

    const result = await new GetAuditTrail({ entries, clock }).execute('default', {
      ...EMPTY_AUDIT_FILTER,
      actor: { kind: 'member', id: 'x'.repeat(500) },
    });

    expect(result.isErr() && result.error).toMatchObject({
      fieldErrors: { actorId: ['audit.validation.id_invalid'] },
    });
    expect(entries.calls.listed).toEqual([]);
  });

  it('resolves the period against the clock and passes the filter on as criteria', async () => {
    const entries = fakeRepository();

    await new GetAuditTrail({ entries, clock }).execute('default', {
      ...EMPTY_AUDIT_FILTER,
      period: '24h',
      onlyWarnings: true,
      type: 'authorization.denied',
      actor: { kind: 'visitor' },
    });

    expect(entries.calls.listed[0]?.criteria).toEqual({
      source: null,
      type: 'authorization.denied',
      actor: { kind: 'visitor' },
      since: new Date('2026-06-14T10:30:00.000Z'),
      onlyWarnings: true,
    });
  });

  it('bounds the page, whatever the address asks for, and falls back on nonsense', async () => {
    const entries = fakeRepository();

    await new GetAuditTrail({ entries, clock }).execute('default', EMPTY_AUDIT_FILTER, {
      page: '2',
      pageSize: '100000',
    });
    await new GetAuditTrail({ entries, clock }).execute('default', EMPTY_AUDIT_FILTER, {
      page: 'abc',
      pageSize: -3,
    });

    // The first read asks for page 2 at the capped size; the empty trail has no page 2, so it is read
    // again from page 1. The second request falls back on the defaults.
    expect(entries.calls.listed.map((call) => call.page)).toEqual([
      { page: 2, pageSize: 50 },
      { page: 1, pageSize: 50 },
      { page: 1, pageSize: 25 },
    ]);
  });

  it('shows an entry to the reader as ids and codes, naming an actor only for a member', async () => {
    const entries = fakeRepository({
      items: [
        stored({ id: 'a' }),
        stored({ id: 'b', actor: { kind: 'visitor' }, type: 'authentication.sign_in_failed' }),
      ],
    });

    const result = await new GetAuditTrail({ entries, clock }).execute(
      'default',
      EMPTY_AUDIT_FILTER,
    );

    const views = result.isOk() ? result.value.entries.items : [];
    expect(views.map((view) => [view.id, view.actorKind, view.actorId])).toEqual([
      ['a', 'member', 'parent-1'],
      ['b', 'visitor', null],
    ]);
  });

  it('reports a failing store as one infrastructure error', async () => {
    const entries = fakeRepository({ failWith: STORE_DOWN });

    const result = await new GetAuditTrail({ entries, clock }).execute(
      'default',
      EMPTY_AUDIT_FILTER,
    );

    expect(result.isErr() && result.error.kind).toBe('infrastructure');
  });

  it('moves a page past the end back to the last page', async () => {
    const entries = fakeRepository({ total: 30 });

    await new GetAuditTrail({ entries, clock }).execute('default', EMPTY_AUDIT_FILTER, { page: 9 });

    expect(entries.calls.listed.map((call) => call.page.page)).toEqual([9, 2]);
  });
});

describe('GetAllTenantsAuditTrail', () => {
  it('reads across tenants only when no tenant is named, and says so with a scope of its own', async () => {
    const entries = fakeRepository();

    await new GetAllTenantsAuditTrail({ entries, clock }).execute(EMPTY_AUDIT_FILTER);

    expect(entries.calls.listed.map((call) => call.scope)).toEqual([{ kind: 'platform' }]);
  });

  it('narrows to one tenant when the filter names a valid one', async () => {
    const entries = fakeRepository();

    await new GetAllTenantsAuditTrail({ entries, clock }).execute({
      ...EMPTY_AUDIT_FILTER,
      tenantId: 'default',
    });

    expect(entries.calls.listed.map((call) => call.scope)).toEqual([
      { kind: 'tenant', tenantId: 'default' },
    ]);
  });

  it('does not widen to every tenant when the named tenant is malformed', async () => {
    const entries = fakeRepository();

    const result = await new GetAllTenantsAuditTrail({ entries, clock }).execute({
      ...EMPTY_AUDIT_FILTER,
      tenantId: '',
    });

    // An empty id is "not narrowed" for a platform screen only through `null`; a bad id is an error.
    expect(result.isErr() && result.error.kind).toBe('validation');
    expect(entries.calls.listed).toEqual([]);
  });
});

describe('GetAuditDigest', () => {
  it('shows a whole month of days, the quiet ones as zero, with totals that add up', async () => {
    const entries = fakeRepository({
      items: [stored()],
      days: [
        { day: '2026-06-15', total: 4, warnings: 1 },
        { day: '2026-06-10', total: 2, warnings: 0 },
      ],
    });

    const result = await new GetAuditDigest({ entries, clock }).execute('default');

    const digest = result.isOk() ? result.value : null;
    expect(digest?.days).toHaveLength(30);
    expect(digest?.days[0]?.day).toBe('2026-05-17');
    expect(digest?.days.at(-1)).toEqual({ day: '2026-06-15', total: 4, warnings: 1 });
    expect(digest?.days.find((day) => day.day === '2026-06-12')).toEqual({
      day: '2026-06-12',
      total: 0,
      warnings: 0,
    });
    expect([digest?.total, digest?.warnings]).toEqual([6, 1]);
    expect(entries.calls.perDay).toEqual([
      { tenantId: TENANT, since: new Date('2026-05-17T00:00:00.000Z') },
    ]);
  });

  it('refuses a missing tenant before reading anything', async () => {
    const entries = fakeRepository();

    const result = await new GetAuditDigest({ entries, clock }).execute('');

    expect(result.isErr() && result.error.kind).toBe('validation');
    expect(entries.calls.listed).toEqual([]);
    expect(entries.calls.perDay).toEqual([]);
  });
});
