import { describe, expect, it } from 'vitest';

import { GetCurrentActor } from '@modules/auth/application/queries/get-current-actor';
import { unauthenticated } from '@modules/auth/domain/errors/auth-errors';

import { failingWith, parent, signedInAs } from '../fakes';

describe('GetCurrentActor', () => {
  it('describes the signed-in parent as plain data', async () => {
    const query = new GetCurrentActor({ currentActor: signedInAs(parent()) });

    const result = await query.execute();

    expect(result.isOk() && result.value).toEqual({
      id: 'parent-1',
      tenantId: 'default',
      roles: ['parent'],
    });
  });

  it('tells an anonymous caller only that they are anonymous', async () => {
    const query = new GetCurrentActor({ currentActor: failingWith(unauthenticated()) });

    const result = await query.execute();

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'unauthorized',
      code: 'auth.unauthenticated',
    });
  });
});
