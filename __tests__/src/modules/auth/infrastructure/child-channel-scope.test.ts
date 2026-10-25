import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { decide } from '@modules/auth/domain/models/authorize';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PERMISSIONS } from '@modules/auth/domain/models/permission';
import type { Permission } from '@modules/auth/domain/models/permission';
import { CHILD_CHANNEL_ROLE } from '@modules/auth/domain/models/role';
import {
  runInChildChannel,
  withChildChannelScope,
} from '@modules/auth/infrastructure/channel/child-channel-scope';

import { unauthorizedError } from '@lib/errors';

import { TENANT, failingWith, parent, recordingAudit, signedInAs } from '../fakes';

const GUARDIAN = 'guardian-1';
const OWN_CHILD = { tenantId: TENANT, ownerId: toActorId(GUARDIAN), childProfileId: 'child-1' };
const SIBLING = { ...OWN_CHILD, childProfileId: 'child-2' };
const CHILD_SIDE: readonly Permission[] = [
  'learner.read',
  'progression.read',
  'progression.daily_reward',
];
const binding = {
  channel: 'alexa',
  guardianId: GUARDIAN,
  childProfileId: 'child-1',
  tenantId: TENANT,
};
const channelActor: Actor = {
  id: toActorId(GUARDIAN),
  tenantId: TENANT,
  roles: [CHILD_CHANNEL_ROLE],
  delegation: { channel: 'alexa', childProfileId: 'child-1' },
};

const noSession = failingWith(unauthorizedError('auth.no_session', 'No session.'));

describe('child channel role', () => {
  it('holds exactly the child-side permissions on the own child', () => {
    const allowed = PERMISSIONS.filter(
      (permission) => decide(channelActor, permission, OWN_CHILD).isAllowed,
    );

    expect(allowed).toEqual(CHILD_SIDE);
  });

  it('is denied every parent and teacher operation (settings, consent, onboarding, voice, hints)', () => {
    for (const permission of PERMISSIONS.filter((p) => !CHILD_SIDE.includes(p))) {
      expect(decide(channelActor, permission, OWN_CHILD)).toEqual({
        isAllowed: false,
        reason: 'permission_missing',
      });
    }
  });

  it('is denied learning XP and the onboarding list of all profiles', () => {
    expect(decide(channelActor, 'progression.update', OWN_CHILD).isAllowed).toBe(false);
    expect(decide(channelActor, 'learner.list').isAllowed).toBe(false);
  });

  it('is denied a sibling of the bound child, and any resource of no child', () => {
    expect(decide(channelActor, 'learner.read', SIBLING)).toEqual({
      isAllowed: false,
      reason: 'child_mismatch',
    });
    expect(
      decide(channelActor, 'learner.read', { tenantId: TENANT, ownerId: toActorId(GUARDIAN) }),
    ).toEqual({ isAllowed: false, reason: 'child_mismatch' });
  });

  it('leaves a guardian without delegation free to reach every own child', () => {
    const guardian: Actor = { ...parent(), id: toActorId(GUARDIAN) };

    expect(decide(guardian, 'learner.read', SIBLING).isAllowed).toBe(true);
  });

  it("is denied another guardian's child", () => {
    expect(
      decide(channelActor, 'learner.read', { tenantId: TENANT, ownerId: toActorId('guardian-2') }),
    ).toEqual({ isAllowed: false, reason: 'owner_mismatch' });
  });
});

describe('child channel scope', () => {
  it('leaves a request outside the scope (every web request) on its own session', async () => {
    const provider = withChildChannelScope(signedInAs(parent()));

    expect((await provider.getCurrentActor())._unsafeUnwrap()).toEqual(parent());
    expect((await withChildChannelScope(noSession).getCurrentActor()).isErr()).toBe(true);
  });

  it('is the channel actor inside the scope only, and ends with it', async () => {
    const provider = withChildChannelScope(noSession);

    const inside = await runInChildChannel(binding, async () => provider.getCurrentActor());

    expect(inside._unsafeUnwrap()).toEqual(channelActor);
    expect((await provider.getCurrentActor()).isErr()).toBe(true);
  });

  it('does not leak into a concurrent request that runs outside the scope', async () => {
    const provider = withChildChannelScope(signedInAs(parent()));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const channel = runInChildChannel(binding, async () => {
      await gate;
      return provider.getCurrentActor();
    });
    const web = provider.getCurrentActor();
    release();

    expect((await web)._unsafeUnwrap()).toEqual(parent());
    expect((await channel)._unsafeUnwrap()).toEqual(channelActor);
  });

  it('lets the authorization service allow child-side and refuse parent operations', async () => {
    const audit = recordingAudit();
    const authorization = createAuthorizationService({
      currentActor: withChildChannelScope(noSession),
      audit,
    });

    const [read, claim, settings, create, sibling] = await runInChildChannel(binding, () =>
      Promise.all([
        authorization.requireOnResource('learner.read', OWN_CHILD),
        authorization.requireOnResource('progression.daily_reward', OWN_CHILD),
        authorization.requireOnResource('learner.update', OWN_CHILD),
        authorization.requireInTenant('learner.create'),
        authorization.requireOnResource('learner.read', SIBLING),
      ]),
    );

    expect(read.isOk() && claim.isOk()).toBe(true);
    expect(settings._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(create.isErr()).toBe(true);
    expect(sibling._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(audit.events).toContainEqual(
      expect.objectContaining({ reason: 'child_mismatch', channel: 'alexa', onBehalfOf: GUARDIAN }),
    );
    expect(audit.events.some((event) => 'actorId' in event)).toBe(false);
  });
});
