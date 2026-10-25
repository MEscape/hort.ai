import { describe, expect, it } from 'vitest';

import { actorHasPermission, decide } from '@modules/auth/domain/models/authorize';
import { toActorId } from '@modules/auth/domain/models/ids';
import { PERMISSIONS } from '@modules/auth/domain/models/permission';
import { permissionsForRole, ROLES } from '@modules/auth/domain/models/role';

import { OTHER_TENANT, TENANT, parent } from '../fakes';

const OWN_PROFILE = { tenantId: TENANT, ownerId: toActorId('parent-1') };

describe('decide', () => {
  it('lets a parent act on a resource they own', () => {
    for (const permission of permissionsForRole('parent')) {
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
  it('together grant every permission of the closed set, so a new permission is a deliberate grant', () => {
    const granted = ROLES.flatMap((role) => permissionsForRole(role));

    expect([...new Set(granted)].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('give a parent the learner permissions, the hint request and nothing of a class', () => {
    const permissions = permissionsForRole('parent');

    expect(permissions.filter((permission) => !permission.startsWith('learner.'))).toEqual([
      'hint.request',
    ]);
    expect(permissions).not.toContain('classroom.read');
  });

  it('give a teacher classes, material and assignments, but no learner permission and no hints', () => {
    const permissions = permissionsForRole('teacher');

    expect(permissions.some((permission) => permission.startsWith('learner.'))).toBe(false);
    expect(permissions).not.toContain('hint.request');
    expect(permissions).toEqual(expect.arrayContaining(['classroom.create', 'material.create']));
  });

  it("refuses a teacher a child profile, even one carrying the teacher's own id", () => {
    const teacher = parent({ roles: ['teacher'] });

    for (const permission of permissionsForRole('parent')) {
      expect(decide(teacher, permission, OWN_PROFILE)).toEqual({
        isAllowed: false,
        reason: 'permission_missing',
      });
    }
  });

  it('refuses a parent every class permission', () => {
    for (const permission of permissionsForRole('teacher')) {
      expect(actorHasPermission(parent(), permission)).toBe(false);
    }
  });
});
