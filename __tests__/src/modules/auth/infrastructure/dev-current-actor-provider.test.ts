import { describe, expect, it } from 'vitest';

import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId } from '@modules/auth/domain/models/ids';
import { DevCurrentActorProvider } from '@modules/auth/infrastructure/dev/dev-current-actor-provider';

import { TENANT } from '../fakes';

const LOCAL = { tenantId: TENANT, nodeEnv: 'development', appUrl: 'http://localhost:3000' };

describe('DevCurrentActorProvider', () => {
  it('acts as one fixed parent of the configured tenant', async () => {
    const result = await new DevCurrentActorProvider(LOCAL).getCurrentActor();

    expect(result.isOk() && result.value).toEqual({
      id: 'dev-actor-not-a-real-user',
      tenantId: 'default',
      roles: ['parent'],
    });
  });

  it('is still subject to authorization: it owns only what is stored under its own id', async () => {
    const result = await new DevCurrentActorProvider(LOCAL).getCurrentActor();
    const actor = result.isOk() ? result.value : null;

    expect(
      actor &&
        decide(actor, 'learner.read', { tenantId: TENANT, ownerId: toActorId('someone-else') }),
    ).toEqual({
      isAllowed: false,
      reason: 'owner_mismatch',
    });
  });

  it('can never be built in production', () => {
    expect(() => new DevCurrentActorProvider({ ...LOCAL, nodeEnv: 'production' })).toThrow(
      /never be constructed in production/,
    );
  });

  it.each([
    'https://hortai.example',
    'http://staging.internal:3000',
    'http://localhost.evil.example',
    'not a url',
    '',
  ])('refuses an app address that is not provably this machine: %j', (appUrl) => {
    expect(() => new DevCurrentActorProvider({ ...LOCAL, appUrl })).toThrow(/loopback/);
  });

  it.each(['http://127.0.0.1:3000', 'http://[::1]:3000', 'http://hortai.localhost:3000'])(
    'accepts the loopback address %s',
    (appUrl) => {
      expect(() => new DevCurrentActorProvider({ ...LOCAL, appUrl })).not.toThrow();
    },
  );
});
