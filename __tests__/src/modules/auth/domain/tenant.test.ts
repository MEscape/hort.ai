import { describe, expect, it } from 'vitest';

import { createTenantId } from '@modules/auth/domain/models/tenant';

describe('createTenantId', () => {
  it.each(['default', 'school-7', 'a', 'x'.repeat(64)])('accepts %j', (raw) => {
    const result = createTenantId(raw);

    expect(result.isOk() && result.value).toBe(raw);
  });

  it.each([
    '',
    'Default',
    ' default',
    'default ',
    'two words',
    'under_score',
    '-lead',
    'trail-',
    'double--hyphen',
    '../etc',
    'tenant/../x',
    'x'.repeat(65),
  ])('rejects %j with a validation error that names the field', (raw) => {
    const result = createTenantId(raw);

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { tenantId: ['auth.validation.tenant_invalid'] },
    });
  });
});
