import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { OpenParentArea } from '@modules/auth/application/commands/open-parent-area';
import { invalidCredentials } from '@modules/auth/domain/errors/auth-errors';
import type { ParentAccessPort } from '@modules/auth/domain/ports/parent-access.port';

import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { TENANT, clientAt, parent, recordingAudit, signedInAs } from '../fakes';

const CORRECT = 'correct horse';

function build() {
  const audit = recordingAudit();
  const parentAccess: ParentAccessPort = {
    open: (password) =>
      password === CORRECT ? okAsync(undefined) : errAsync(invalidCredentials()),
    require: () => okAsync(undefined),
    close: () => okAsync(undefined),
  };
  const open = new OpenParentArea({
    authorization: createAuthorizationService({ currentActor: signedInAs(parent()), audit }),
    parentAccess,
    audit,
    rateLimiter: createTestRateLimiter(),
    clientAddress: clientAt('203.0.113.7'),
  });
  return { open, audit };
}

describe('OpenParentArea', () => {
  it('audits an opened parent area for the signed-in parent', async () => {
    const { open, audit } = build();

    expect((await open.execute(CORRECT)).isOk()).toBe(true);
    expect(audit.events).toEqual([
      { type: 'authentication.parent_area_opened', actorId: parent().id, tenantId: TENANT },
    ]);
  });

  it('audits a wrong password at the gate with its error code and keeps the error', async () => {
    const { open, audit } = build();

    const result = await open.execute('guess');

    expect(result.isErr() && result.error.code).toBe('auth.invalid_credentials');
    expect(audit.events).toEqual([
      {
        type: 'authentication.parent_area_open_failed',
        actorId: parent().id,
        tenantId: TENANT,
        errorCode: 'auth.invalid_credentials',
      },
    ]);
  });

  it('records nothing for an empty password, which never reaches the provider', async () => {
    const { open, audit } = build();

    expect((await open.execute('')).isErr()).toBe(true);
    expect(audit.events).toEqual([]);
  });
});
