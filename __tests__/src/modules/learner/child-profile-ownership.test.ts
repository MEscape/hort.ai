import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { toActorId } from '@modules/auth/domain/models/ids';
import { CreateChildProfile } from '@modules/learner/application/commands/create-child-profile';
import { DeleteChildProfile } from '@modules/learner/application/commands/delete-child-profile';
import { UpdateChildProfile } from '@modules/learner/application/commands/update-child-profile';
import type { LearnerDependencies } from '@modules/learner/application/learner-dependencies';
import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';
import { ListChildProfiles } from '@modules/learner/application/queries/list-child-profiles';
import type { ChildProfile } from '@modules/learner/domain/models/child-profile';
import { toChildProfileId } from '@modules/learner/domain/models/ids';
import type { ChildProfileRepository } from '@modules/learner/domain/ports/child-profile.repository';
import type { LearnerEvent } from '@modules/learner/domain/ports/learner-audit-log.port';

import { okAsync } from '@lib/result';

import { TENANT, parent, recordingAudit, signedInAs } from '../auth/fakes';

const NOW = new Date('2026-10-24T12:00:00.000Z');
const MARA = parent();
const OTHER_PARENT = parent({ id: toActorId('parent-2') });
const TEACHER = parent({ id: toActorId('teacher-1'), roles: ['teacher'] });

/** An in-memory repository that behaves like the Prisma one: scoped by tenant, list by owner. */
function memoryRepository(): ChildProfileRepository & { readonly rows: ChildProfile[] } {
  const rows: ChildProfile[] = [];
  let next = 1;
  return {
    rows,
    findById: (id, tenantId) =>
      okAsync(rows.find((row) => row.id === id && row.tenantId === tenantId) ?? null),
    listByOwner: (tenantId, ownerId, limit) =>
      okAsync(
        rows.filter((row) => row.tenantId === tenantId && row.ownerId === ownerId).slice(0, limit),
      ),
    create: ({ tenantId, ownerId, draft }) => {
      const row: ChildProfile = {
        id: toChildProfileId(`child-${String(next++)}`),
        tenantId,
        ownerId,
        ...draft,
        createdAt: NOW,
        updatedAt: NOW,
      };
      rows.push(row);
      return okAsync(row);
    },
    update: (id, _tenantId, changes) => {
      const index = rows.findIndex((row) => row.id === id);
      const updated = { ...rows[index], ...changes } as ChildProfile;
      rows[index] = updated;
      return okAsync(updated);
    },
    deleteById: (id) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) {
        rows.splice(index, 1);
      }
      return okAsync(undefined);
    },
  };
}

function build(actor: Actor, childProfiles = memoryRepository()) {
  const events: LearnerEvent[] = [];
  const deps: LearnerDependencies = {
    authorization: createAuthorizationService({
      currentActor: signedInAs(actor),
      audit: recordingAudit(),
    }),
    childProfiles,
    audit: { record: (event) => events.push(event) },
  };
  return {
    childProfiles,
    events,
    create: new CreateChildProfile(deps),
    get: new GetChildProfileById(deps),
    list: new ListChildProfiles(deps),
    update: new UpdateChildProfile(deps),
    remove: new DeleteChildProfile(deps),
  };
}

const MIA = { displayName: 'Mia', federalState: 'he', grade: 2, companion: 'lili' };

async function marasChild() {
  const repository = memoryRepository();
  const created = await build(MARA, repository).create.execute(MIA);
  if (created.isErr()) {
    throw new Error('setup failed');
  }
  return { repository, id: created.value.id };
}

describe('learner use cases: ownership', () => {
  it('stores the signed-in parent as the owner, never a request field', async () => {
    const { repository } = await marasChild();

    expect(repository.rows[0]).toMatchObject({ ownerId: MARA.id, tenantId: TENANT });
    expect(repository.rows[0]?.voiceConsent).toBe(false);
  });

  it('lets the owner read, change and delete their child profile', async () => {
    const { repository, id } = await marasChild();
    const mara = build(MARA, repository);

    expect((await mara.get.execute(id)).isOk()).toBe(true);
    const updated = await mara.update.execute({ id, grade: 3 });
    expect(updated.isOk() && updated.value.grade).toBe(3);
    expect((await mara.remove.execute({ id })).isOk()).toBe(true);
    expect(repository.rows).toEqual([]);
  });

  it.each(['get', 'update', 'remove'] as const)(
    "refuses another parent the %s of someone else's child: auth.permission_denied",
    async (operation) => {
      const { repository, id } = await marasChild();
      const other = build(OTHER_PARENT, repository);

      const result =
        operation === 'get'
          ? await other.get.execute(id)
          : operation === 'update'
            ? await other.update.execute({ id, grade: 4 })
            : await other.remove.execute({ id });

      expect(result.isErr() && result.error.code).toBe('auth.permission_denied');
      expect(repository.rows[0]?.grade).toBe(2);
      expect(other.events).toEqual([]);
    },
  );

  it("lists only the parent's own child profiles", async () => {
    const { repository } = await marasChild();
    await build(OTHER_PARENT, repository).create.execute({ ...MIA, displayName: 'Ben' });

    const listed = await build(MARA, repository).list.execute();

    expect(listed.isOk() && listed.value.map((view) => view.displayName)).toEqual(['Mia']);
  });

  it('refuses a teacher every child profile operation (no learner.* permission)', async () => {
    const { repository, id } = await marasChild();
    const teacher = build(TEACHER, repository);

    for (const result of [
      await teacher.create.execute(MIA),
      await teacher.get.execute(id),
      await teacher.list.execute(),
      await teacher.remove.execute({ id }),
    ]) {
      expect(result.isErr() && result.error.code).toBe('auth.permission_denied');
    }
    expect(repository.rows).toHaveLength(1);
  });
});
