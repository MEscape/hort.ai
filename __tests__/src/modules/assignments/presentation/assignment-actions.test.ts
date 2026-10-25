import { revalidatePath } from 'next/cache';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAssignmentAction } from '@modules/assignments/presentation/actions/create-assignment-action';
import { deleteAssignmentAction } from '@modules/assignments/presentation/actions/delete-assignment-action';
import { updateAssignmentAction } from '@modules/assignments/presentation/actions/update-assignment-action';
import type { Actor } from '@modules/auth/domain/models/actor';

import { createWorld, DRAFT, PARENT, TEACHER_A } from '../fakes';

/** The composition root, rebuilt per test for whoever is "signed in". */
const composition = vi.hoisted(() => ({
  assignmentsCommands: {} as Record<
    'createAssignment' | 'updateAssignment' | 'deleteAssignment',
    unknown
  >,
}));
vi.mock('@modules/assignments/composition', () => composition);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

let world = createWorld();

function signIn(actor: Actor) {
  const useCases = world.as(actor);
  composition.assignmentsCommands = {
    createAssignment: useCases.create,
    updateAssignment: useCases.update,
    deleteAssignment: useCases.remove,
  };
}

describe('assignment Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world = createWorld();
  });

  it('refuses malformed input before any use case runs', async () => {
    signIn(TEACHER_A);
    for (const result of [
      await createAssignmentAction({ title: 7 }),
      await updateAssignmentAction(null),
      await deleteAssignmentAction({ id: '' }),
    ]) {
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code).toBe('assignments.validation_failed');
    }
    expect(world.rows.size).toBe(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('saves for the signed-in teacher and ignores an owner sent by the browser', async () => {
    signIn(TEACHER_A);
    const result = await createAssignmentAction({
      ...DRAFT,
      classroomId: 'class-a',
      ownerId: 'teacher-b',
      tenantId: 'other',
    });
    expect(result.ok && result.data).toEqual({ id: expect.any(String), ...DRAFT });
    const [stored] = world.rows.values();
    expect(stored?.ownerId).toBe(TEACHER_A.id);
    expect(stored?.tenantId).toBe(TEACHER_A.tenantId);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/teacher/assignments', 'page');
  });

  it('returns stable codes, not prose, when a parent tries teacher actions', async () => {
    signIn(PARENT);
    const result = await createAssignmentAction({ ...DRAFT, classroomId: 'class-a' });
    expect(result).toEqual({
      ok: false,
      error: { code: 'auth.permission_denied', message: expect.any(String) },
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updates and deletes through the authorized use cases', async () => {
    signIn(TEACHER_A);
    const created = await createAssignmentAction({ ...DRAFT, classroomId: 'class-a' });
    const id = created.ok ? created.data.id : '';
    const updated = await updateAssignmentAction({ ...DRAFT, id, title: 'Neu' });
    expect(updated.ok && updated.data.title).toBe('Neu');
    expect((await deleteAssignmentAction({ id })).ok).toBe(true);
    expect(world.rows.size).toBe(0);
  });
});
