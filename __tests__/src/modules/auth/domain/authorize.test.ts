import { describe, expect, it } from 'vitest';

import { actorHasPermission, decide } from '@modules/auth/domain/models/authorize';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PERMISSIONS } from '@modules/auth/domain/models/permission';
import { permissionsForRole } from '@modules/auth/domain/models/role';

import { OTHER_TENANT, TENANT, admin, parent } from '../fakes';

const OWN_PROFILE = { tenantId: TENANT, ownerId: toActorId('parent-1') };

describe('decide', () => {
  it('lets a parent act on a resource they own', () => {
    for (const permission of PERMISSIONS) {
      expect(decide(parent(), permission, OWN_PROFILE)).toEqual({ isAllowed: true });
    }
  });

  it('lets a parent act on nothing in particular (create, list their own)', () => {
    expect(decide(parent(), 'learner.create')).toEqual({ isAllowed: true });
  });

  it("refuses another parent's resource even though the permission is held", () => {
    const decision = decide(parent(), 'learner.read', {
      tenantId: TENANT,
      ownerId: toActorId('parent-2'),
    });

    expect(decision).toEqual({ isAllowed: false, reason: 'owner_mismatch' });
  });

  it('refuses a resource of another tenant', () => {
    const decision = decide(parent(), 'learner.read', {
      tenantId: OTHER_TENANT,
      ownerId: toActorId('parent-1'),
    });

    expect(decision).toEqual({ isAllowed: false, reason: 'tenant_mismatch' });
  });

  it('names the tenant first when both the tenant and the owner differ', () => {
    const decision = decide(parent(), 'learner.read', {
      tenantId: OTHER_TENANT,
      ownerId: toActorId('parent-2'),
    });

    expect(decision).toEqual({ isAllowed: false, reason: 'tenant_mismatch' });
  });

  it('refuses an actor who holds no role, even on a resource they own', () => {
    const decision = decide(parent({ roles: [] }), 'learner.read', OWN_PROFILE);

    expect(decision).toEqual({ isAllowed: false, reason: 'permission_missing' });
  });
});

describe('decide for a platform admin', () => {
  const FOREIGN = { tenantId: TENANT, ownerId: toActorId('parent-2') };

  it("lets an admin act on another parent's resource", () => {
    for (const permission of PERMISSIONS) {
      expect(decide(admin(), permission, FOREIGN)).toEqual({ isAllowed: true });
    }
  });

  it("still refuses a resource of another tenant: the tenant boundary is not the admin's to cross", () => {
    const decision = decide(admin(), 'learner.read', { ...FOREIGN, tenantId: OTHER_TENANT });

    expect(decision).toEqual({ isAllowed: false, reason: 'tenant_mismatch' });
  });
});

describe('actorHasPermission', () => {
  it('is true for every permission a parent role grants', () => {
    for (const permission of permissionsForRole('parent')) {
      expect(actorHasPermission(parent(), permission)).toBe(true);
    }
  });

  it('is false without roles', () => {
    expect(actorHasPermission(parent({ roles: [] }), 'learner.create')).toBe(false);
  });
});

describe('the roles', () => {
  it.each(['parent', 'platform_admin'] as const)(
    'holds every permission of the closed set, so a new permission is a deliberate grant: %s',
    (role) => {
      expect([...permissionsForRole(role)].sort()).toEqual([...PERMISSIONS].sort());
    },
  );
});
