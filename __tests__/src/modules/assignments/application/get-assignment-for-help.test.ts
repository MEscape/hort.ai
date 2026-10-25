import { describe, expect, it, vi } from 'vitest';

import { DRAFT, OTHER_PARENT, PARENT, TEACHER_A, TEACHER_B, createWorld } from '../fakes';

async function post(world: ReturnType<typeof createWorld>, classroomId = 'class-a') {
  const teacher = classroomId === 'class-b' ? TEACHER_B : TEACHER_A;
  return (await world.as(teacher).create.execute({ ...DRAFT, classroomId }))._unsafeUnwrap();
}

describe('GetAssignmentForHelp (#33)', () => {
  it("gives the parent's child an assignment of its own class, with the teacher's key", async () => {
    const world = createWorld();
    const posted = await post(world);

    const result = await world
      .as(PARENT)
      .forHelp.execute({ childProfileId: 'child-in-a', assignmentId: posted.id });

    expect(result._unsafeUnwrap()).toEqual({
      id: posted.id,
      taskText: DRAFT.taskText,
      solutionKey: DRAFT.solutionKey,
    });
  });

  it("answers another class's assignment, and any for a child in no class, as not found", async () => {
    const world = createWorld();
    const ownClass = await post(world);
    const otherClass = await post(world, 'class-b');
    const parent = world.as(PARENT);

    const foreign = await parent.forHelp.execute({
      childProfileId: 'child-in-a',
      assignmentId: otherClass.id,
    });
    const noClass = await parent.forHelp.execute({
      childProfileId: 'child-without-class',
      assignmentId: ownClass.id,
    });
    const missing = await parent.forHelp.execute({
      childProfileId: 'child-in-a',
      assignmentId: 'assignment-404',
    });

    for (const result of [foreign, noClass, missing]) {
      expect(result.isErr() && result.error.code).toBe('assignments.not_found');
    }
  });

  it('refuses another parent and every teacher before any assignment is read', async () => {
    const world = createWorld();
    const posted = await post(world);
    const findForHelp = vi.spyOn(world.repository, 'findForHelp');

    for (const actor of [OTHER_PARENT, TEACHER_A]) {
      const result = await world
        .as(actor)
        .forHelp.execute({ childProfileId: 'child-in-a', assignmentId: posted.id });
      expect(result.isErr() && result.error.code).toBe('auth.permission_denied');
    }
    expect(findForHelp).not.toHaveBeenCalled();
  });

  it('rejects malformed ids before asking the classroom module or storage', async () => {
    const world = createWorld();
    const findForHelp = vi.spyOn(world.repository, 'findForHelp');

    const result = await world
      .as(PARENT)
      .forHelp.execute({ childProfileId: 'child-in-a', assignmentId: '' });

    expect(result.isErr() && result.error.code).toBe('assignments.invalid_id');
    expect(findForHelp).not.toHaveBeenCalled();
  });
});
