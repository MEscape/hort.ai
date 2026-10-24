// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NewAuditEntry } from '@modules/audit/domain/models/audit-entry';
import { toActorId, toTenantId } from '@modules/audit/domain/models/ids';
import type { TenantId } from '@modules/audit/domain/models/ids';
import type {
  AuditCriteria,
  AuditTrailRepository,
} from '@modules/audit/domain/ports/audit-trail.repository';

import type { db as Db } from '@lib/db';

/**
 * The Prisma adapter against the real `AuditEntry` table: the local Postgres from
 * `docker compose up` after `npm run db:migrate` (CI migrates its own). It reads the application's own
 * `DATABASE_URL` and is skipped when none is configured. Every test writes under tenants of its own,
 * named after the run, so tests never depend on each other or on other data, and the run removes
 * what it wrote.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

const NO_CRITERIA: AuditCriteria = {
  source: null,
  type: null,
  actor: null,
  since: null,
  onlyWarnings: false,
};
const FIRST_PAGE = { page: 1, pageSize: 50 };
const at = (iso: string) => new Date(iso);
const PARENT = toActorId('parent-1');

describe.skipIf(!isEnabled)('PrismaAuditTrailRepository against Postgres', () => {
  const runId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const used: TenantId[] = [];
  let sequence = 0;

  let repository: AuditTrailRepository;
  let db: typeof Db;
  let disconnect: () => Promise<void>;

  function freshTenant(): TenantId {
    sequence += 1;
    const tenantId = toTenantId(`${runId}-${sequence}`);
    used.push(tenantId);
    return tenantId;
  }

  function entryOf(tenantId: TenantId, overrides: Partial<NewAuditEntry> = {}): NewAuditEntry {
    return {
      tenantId,
      source: 'auth',
      type: 'authentication.session_created',
      severity: 'info',
      actor: { kind: 'member', id: PARENT },
      details: {},
      occurredAt: at('2026-06-15T10:00:00.000Z'),
      ...overrides,
    };
  }

  async function seed(...entries: NewAuditEntry[]) {
    for (const entry of entries) {
      expect((await repository.append(entry)).isOk()).toBe(true);
    }
  }

  async function listOf(tenantId: TenantId, criteria: Partial<AuditCriteria> = {}) {
    const result = await repository.list(
      { kind: 'tenant', tenantId },
      { ...NO_CRITERIA, ...criteria },
      FIRST_PAGE,
    );
    if (result.isErr()) {
      throw new Error(`list failed: ${result.error.code}`);
    }
    return result.value;
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    const { PrismaAuditTrailRepository } =
      await import('@modules/audit/infrastructure/prisma/prisma-audit-trail.repository');
    db = database.db;
    disconnect = database.disconnectDb;
    repository = new PrismaAuditTrailRepository();
  });

  afterAll(async () => {
    for (const tenantId of used) {
      await db.orm.public.AuditEntry.where({ tenantId }).deleteAndCount();
    }
    await disconnect();
  });

  it('stores an entry and reads it back as the domain entry', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant, {
        details: { permission: 'learner.read', count: 2, ok: true, fields: ['a', 'b'] },
      }),
    );

    const page = await listOf(tenant);

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      tenantId: tenant,
      source: 'auth',
      type: 'authentication.session_created',
      severity: 'info',
      actor: { kind: 'member', id: PARENT },
      details: { permission: 'learner.read', count: 2, ok: true, fields: ['a', 'b'] },
      occurredAt: at('2026-06-15T10:00:00.000Z'),
    });
    expect(page.items[0]?.id).toMatch(/\S+/);
  });

  it('keeps a tenant out of another tenant, and shows both only to the platform scope', async () => {
    const mine = freshTenant();
    const theirs = freshTenant();
    await seed(entryOf(mine), entryOf(theirs, { type: 'authorization.denied', severity: 'warn' }));

    const own = await listOf(mine);
    const platform = await repository.list(
      { kind: 'platform' },
      { ...NO_CRITERIA, type: 'authorization.denied' },
      { page: 1, pageSize: 50 },
    );

    expect(own.items.map((item) => item.tenantId)).toEqual([mine]);
    expect(platform.isOk() && platform.value.items.some((item) => item.tenantId === theirs)).toBe(
      true,
    );
  });

  it('filters by type, warnings, actor and period', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant, {
        type: 'authorization.denied',
        severity: 'warn',
        actor: { kind: 'visitor' },
        occurredAt: at('2026-06-16T10:00:00.000Z'),
      }),
      entryOf(tenant, {
        type: 'authentication.sign_in_failed',
        severity: 'warn',
        actor: { kind: 'system' },
        occurredAt: at('2026-01-01T00:00:00.000Z'),
      }),
      entryOf(tenant),
    );

    expect((await listOf(tenant, { type: 'authorization.denied' })).items).toHaveLength(1);
    expect(
      (await listOf(tenant, { onlyWarnings: true })).items.map((item) => item.type).sort(),
    ).toEqual(['authentication.sign_in_failed', 'authorization.denied']);
    expect((await listOf(tenant, { actor: { kind: 'visitor' } })).items).toHaveLength(1);
    expect(
      (await listOf(tenant, { actor: { kind: 'member', id: PARENT } })).items.map(
        (item) => item.type,
      ),
    ).toEqual(['authentication.session_created']);
    expect(
      (await listOf(tenant, { since: at('2026-06-01T00:00:00.000Z') })).items.map(
        (item) => item.type,
      ),
    ).not.toContain('authentication.sign_in_failed');
  });

  it('lists newest first and pages with a total', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant, { occurredAt: at('2026-06-01T00:00:00.000Z') }),
      entryOf(tenant, { occurredAt: at('2026-06-03T00:00:00.000Z') }),
      entryOf(tenant, { occurredAt: at('2026-06-02T00:00:00.000Z') }),
    );

    const first = await repository.list({ kind: 'tenant', tenantId: tenant }, NO_CRITERIA, {
      page: 1,
      pageSize: 2,
    });
    const second = await repository.list({ kind: 'tenant', tenantId: tenant }, NO_CRITERIA, {
      page: 2,
      pageSize: 2,
    });

    expect(first.isOk() && first.value.items.map((item) => item.occurredAt.toISOString())).toEqual([
      '2026-06-03T00:00:00.000Z',
      '2026-06-02T00:00:00.000Z',
    ]);
    expect(first.isOk() && [first.value.total, first.value.pageCount]).toEqual([3, 2]);
    expect(
      second.isOk() && second.value.items.map((item) => item.occurredAt.toISOString()),
    ).toEqual(['2026-06-01T00:00:00.000Z']);
  });

  it('counts per type and per UTC day, and names the members that appear', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant),
      entryOf(tenant, {
        type: 'authorization.denied',
        severity: 'warn',
        occurredAt: at('2026-06-16T23:59:59.000Z'),
      }),
      entryOf(tenant, { actor: { kind: 'member', id: toActorId('parent-2') } }),
    );

    const counts = await repository.countByType(
      { kind: 'tenant', tenantId: tenant },
      NO_CRITERIA,
      50,
    );
    const members = await repository.listMemberIds({ kind: 'tenant', tenantId: tenant }, 50);
    const perDay = await repository.countPerDay(tenant, at('2026-06-01T00:00:00.000Z'));

    expect(counts.isOk() && counts.value).toEqual([
      { source: 'auth', type: 'authentication.session_created', count: 2 },
      { source: 'auth', type: 'authorization.denied', count: 1 },
    ]);
    expect(members.isOk() && members.value.items).toEqual([PARENT, toActorId('parent-2')]);
    expect(perDay.isOk() && perDay.value).toEqual([
      { day: '2026-06-15', total: 2, warnings: 0 },
      { day: '2026-06-16', total: 1, warnings: 1 },
    ]);
  });

  it('says when more members exist than it was asked for', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant),
      entryOf(tenant, { actor: { kind: 'member', id: toActorId('parent-2') } }),
    );

    const members = await repository.listMemberIds({ kind: 'tenant', tenantId: tenant }, 1);

    expect(members.isOk() && members.value.isTruncated).toBe(true);
    expect(members.isOk() && members.value.items).toHaveLength(1);
  });

  it('removes entries older than the cutoff and keeps the rest', async () => {
    const tenant = freshTenant();
    await seed(
      entryOf(tenant, { occurredAt: at('2000-01-01T00:00:00.000Z') }),
      entryOf(tenant, { occurredAt: at('2026-06-15T10:00:00.000Z') }),
    );

    // The cutoff sits far before anything real, so only this run's own old row is within reach.
    const removed = await repository.deleteOlderThan(at('2001-01-01T00:00:00.000Z'));

    expect(removed.isOk() && removed.value).toBeGreaterThanOrEqual(1);
    expect((await listOf(tenant)).items.map((item) => item.occurredAt.getUTCFullYear())).toEqual([
      2026,
    ]);
  });
});
