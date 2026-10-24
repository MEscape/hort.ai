import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

import {
  createSecurityAuditOptions,
  recordFailedSignIn,
} from '@modules/auth/infrastructure/better-auth/create-security-audit-options';

import { TENANT, recordingAudit } from '../fakes';

const hooks = (audit = recordingAudit()) => ({
  audit,
  database: createSecurityAuditOptions(audit, TENANT).databaseHooks,
});

describe('createSecurityAuditOptions database hooks', () => {
  it('records a created account by id and tenant, with no address or name', async () => {
    const { audit, database } = hooks();

    await database?.user?.create?.after?.(
      // The provider's row also carries the address and name; none of it may reach the event.
      { id: 'u1', email: 'mara@example.org', name: 'Mara' } as never,
      null,
    );

    expect(audit.events).toEqual([
      { type: 'authentication.account_created', actorId: 'u1', tenantId: TENANT },
    ]);
  });

  it('records a created session without its token', async () => {
    const { audit, database } = hooks();

    await database?.session?.create?.after?.(
      { userId: 'u1', token: 'SECRET-SESSION-TOKEN', ipAddress: '203.0.113.7' } as never,
      null,
    );

    expect(audit.events).toEqual([
      { type: 'authentication.session_created', actorId: 'u1', tenantId: TENANT },
    ]);
    expect(JSON.stringify(audit.events)).not.toContain('SECRET-SESSION-TOKEN');
    expect(JSON.stringify(audit.events)).not.toContain('203.0.113.7');
  });

  it('records a revoked session', async () => {
    const { audit, database } = hooks();

    await database?.session?.delete?.after?.({ userId: 'u1' } as never, null);

    expect(audit.events).toEqual([
      { type: 'authentication.session_revoked', actorId: 'u1', tenantId: TENANT },
    ]);
  });
});

describe('recordFailedSignIn', () => {
  it('records only our own error code for a refused sign-in', () => {
    const audit = recordingAudit();
    const refused = new APIError('UNAUTHORIZED', {
      message: 'Invalid email or password for mara@example.org',
      code: 'INVALID_EMAIL_OR_PASSWORD',
    });

    recordFailedSignIn(audit, TENANT, refused);

    expect(audit.events).toEqual([
      {
        type: 'authentication.sign_in_failed',
        tenantId: TENANT,
        errorCode: 'auth.invalid_credentials',
      },
    ]);
    expect(JSON.stringify(audit.events)).not.toContain('mara@example.org');
  });

  it('records nothing when the sign-in did not fail', () => {
    const audit = recordingAudit();

    recordFailedSignIn(audit, TENANT, { user: { id: 'u1' } });
    recordFailedSignIn(audit, TENANT, undefined);

    expect(audit.events).toEqual([]);
  });

  it('records an unclassified provider failure under a code of ours, never the provider text', () => {
    const audit = recordingAudit();

    recordFailedSignIn(
      audit,
      TENANT,
      new APIError('INTERNAL_SERVER_ERROR', { message: 'stack trace here' }),
    );

    expect(audit.events).toEqual([
      {
        type: 'authentication.sign_in_failed',
        tenantId: TENANT,
        errorCode: 'auth.provider_failed',
      },
    ]);
  });
});
