import { describe, expect, it } from 'vitest';

import {
  AUDIT_PERIODS,
  DEFAULT_AUDIT_PERIOD,
  EMPTY_AUDIT_FILTER,
  sinceOf,
} from '@modules/audit/domain/models/audit-filter';
import { PLATFORM_AUDIT_SCOPE, tenantAuditScope } from '@modules/audit/domain/models/audit-scope';
import { parseActorId, parseTenantId, toTenantId } from '@modules/audit/domain/models/ids';

import { NOW } from '../fakes';

const HOUR = 3_600_000;

describe('sinceOf', () => {
  it.each([
    ['24h', 24 * HOUR],
    ['7d', 7 * 24 * HOUR],
    ['30d', 30 * 24 * HOUR],
    ['90d', 90 * 24 * HOUR],
  ] as const)('reads %s as that long before now', (period, milliseconds) => {
    expect(sinceOf(period, NOW)?.getTime()).toBe(NOW.getTime() - milliseconds);
  });

  it('reads "all" as no lower bound', () => {
    expect(sinceOf('all', NOW)).toBeNull();
  });

  it('is defined for every period the module offers', () => {
    for (const period of AUDIT_PERIODS) {
      expect(() => sinceOf(period, NOW)).not.toThrow();
    }
  });

  it('starts from the default period and no narrowing at all', () => {
    expect(EMPTY_AUDIT_FILTER).toEqual({
      tenantId: null,
      source: null,
      type: null,
      actor: null,
      period: DEFAULT_AUDIT_PERIOD,
      onlyWarnings: false,
    });
  });
});

describe('audit scopes', () => {
  it('names a tenant scope by its tenant and the platform scope by nothing a tenant can be called', () => {
    expect(tenantAuditScope(toTenantId('default'))).toEqual({
      kind: 'tenant',
      tenantId: 'default',
    });
    expect(PLATFORM_AUDIT_SCOPE).toEqual({ kind: 'platform' });
  });
});

describe('request-side ids', () => {
  it.each([parseTenantId, parseActorId])('accept an id of reasonable length', (parse) => {
    const result = parse('abc-123');

    expect(result.isOk() && result.value).toBe('abc-123');
  });

  it.each([parseTenantId, parseActorId])('reject an empty id and one beyond the bound', (parse) => {
    for (const raw of ['', 'x'.repeat(129)]) {
      expect(parse(raw).isErr()).toBe(true);
    }
  });

  it('name the offending field in the error', () => {
    const tenant = parseTenantId('');
    const actor = parseActorId('');

    expect(tenant.isErr() && tenant.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { tenantId: ['audit.validation.id_invalid'] },
    });
    expect(actor.isErr() && actor.error).toMatchObject({
      fieldErrors: { actorId: ['audit.validation.id_invalid'] },
    });
  });
});
