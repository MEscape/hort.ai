import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { sessionLookupFailed, unauthenticated } from '@modules/auth/domain/errors/auth-errors';
import { toActorId } from '@modules/auth/domain/models/ids';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';

import { OTHER_TENANT, TENANT, failingWith, parent, recordingAudit, signedInAs } from '../fakes';

function build(currentActor: CurrentActorProvider) {
  const audit = recordingAudit();
  return { access: createAuthorizationService({ currentActor, audit }), audit };
}

const OWN = { tenantId: TENANT, ownerId: toActorId('parent-1') };

describe('AuthorizationService.requireInTenant', () => {
  it('returns the signed-in parent, the authority for what the use case creates or lists', async () => {
    const { access, audit } = build(signedInAs(parent()));

    const result = await access.requireInTenant('learner.create');

    expect(result.isOk() && result.value).toEqual(parent());
    expect(audit.events).toEqual([]);
  });

  it('refuses nobody-in-particular: without a session there is no actor to authorize', async () => {
    const { access, audit } = build(failingWith(unauthenticated()));

    const result = await access.requireInTenant('learner.create');

    expect(result.isErr() && result.error.code).toBe('auth.unauthenticated');
    expect(audit.events).toEqual([]);
  });

  it('refuses an actor without the permission and records who asked for what', async () => {
    const { access, audit } = build(signedInAs(parent({ roles: [] })));

    const result = await access.requireInTenant('learner.create');

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'forbidden',
      code: 'auth.permission_denied',
    });
    expect(audit.events).toEqual([
      {
        type: 'authorization.denied',
        actorId: 'parent-1',
        tenantId: TENANT,
        permission: 'learner.create',
        reason: 'permission_missing',
      },
    ]);
  });

  it('reports a failing session lookup as a failure, never as an allowed or anonymous actor', async () => {
    const { access } = build(failingWith(sessionLookupFailed(new Error('db down'))));

    const result = await access.requireInTenant('learner.read');

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'auth.session_lookup_failed',
    });
  });
});

describe('AuthorizationService.requireOnResource', () => {
  it("lets a parent through to their own child's resource", async () => {
    const { access } = build(signedInAs(parent()));

    const result = await access.requireOnResource('learner.read', OWN);

    expect(result.isOk() && result.value.id).toBe('parent-1');
  });

  it("refuses another parent's resource with the one generic denial", async () => {
    const { access } = build(signedInAs(parent()));

    const result = await access.requireOnResource('learner.read', {
      tenantId: TENANT,
      ownerId: toActorId('parent-2'),
    });

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'forbidden',
      code: 'auth.permission_denied',
    });
  });

  it('gives the caller the same error for a foreign owner, a foreign tenant and a missing permission', async () => {
    const foreignOwner = await build(signedInAs(parent())).access.requireOnResource(
      'learner.read',
      {
        tenantId: TENANT,
        ownerId: toActorId('parent-2'),
      },
    );
    const foreignTenant = await build(signedInAs(parent())).access.requireOnResource(
      'learner.read',
      {
        tenantId: OTHER_TENANT,
        ownerId: toActorId('parent-1'),
      },
    );
    const noPermission = await build(signedInAs(parent({ roles: [] }))).access.requireOnResource(
      'learner.read',
      OWN,
    );

    expect(foreignOwner).toEqual(foreignTenant);
    expect(foreignTenant).toEqual(noPermission);
  });

  it('keeps the precise reason for the audit trail only', async () => {
    const { access, audit } = build(signedInAs(parent()));

    await access.requireOnResource('learner.update', {
      tenantId: TENANT,
      ownerId: toActorId('parent-2'),
    });
    await access.requireOnResource('learner.delete', {
      tenantId: OTHER_TENANT,
      ownerId: toActorId('parent-1'),
    });

    expect(
      audit.events.map((event) => event.type === 'authorization.denied' && event.reason),
    ).toEqual(['owner_mismatch', 'tenant_mismatch']);
    expect(
      audit.events.map((event) => event.type === 'authorization.denied' && event.permission),
    ).toEqual(['learner.update', 'learner.delete']);
  });

  it('records only ids and codes of a denial, nothing about the resource or a person', async () => {
    const { access, audit } = build(signedInAs(parent()));

    await access.requireOnResource('learner.read', {
      tenantId: TENANT,
      ownerId: toActorId('parent-2'),
    });

    expect(Object.keys(audit.events[0] ?? {}).sort()).toEqual([
      'actorId',
      'permission',
      'reason',
      'tenantId',
      'type',
    ]);
  });

  it('refuses without a session and does not reveal whether the resource exists', async () => {
    const { access, audit } = build(failingWith(unauthenticated()));

    const result = await access.requireOnResource('learner.read', OWN);

    expect(result.isErr() && result.error.code).toBe('auth.unauthenticated');
    expect(audit.events).toEqual([]);
  });
});
