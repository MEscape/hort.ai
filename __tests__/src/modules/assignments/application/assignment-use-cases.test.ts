import { describe, expect, it } from 'vitest';

import { createWorld, DRAFT, OTHER_PARENT, PARENT, TEACHER_A, TEACHER_B } from '../fakes';

async function postAs(world: ReturnType<typeof createWorld>, classroomId = 'class-a') {
  const result = await world.as(TEACHER_A).create.execute({ ...DRAFT, classroomId });
  if (result.isErr()) {
    throw new Error(result.error.code);
  }
  return result.value;
}

describe('teacher assignment workflow', () => {
  it('creates, lists after a reload, edits and deletes an assignment of an own class', async () => {
    const world = createWorld();
    const created = await postAs(world);
    expect(created).toEqual({ id: created.id, ...DRAFT });

    const reloaded = await world.as(TEACHER_A).overview.execute('class-a');
    expect(reloaded._unsafeUnwrap()).toEqual({
      classrooms: [
        { id: 'class-a', name: '3a', grade: 3 },
        { id: 'class-a2', name: '4a', grade: 3 },
      ],
      selectedClassroomId: 'class-a',
      assignments: [created],
    });

    const edited = await world.as(TEACHER_A).update.execute({
      ...DRAFT,
      id: created.id,
      title: '  Neue Überschrift  ',
      dueDate: '',
      solutionKey: '',
    });
    expect(edited._unsafeUnwrap()).toMatchObject({
      title: 'Neue Überschrift',
      dueDate: null,
      solutionKey: null,
    });
    expect(
      (await world.as(TEACHER_A).overview.execute('class-a'))._unsafeUnwrap().assignments,
    ).toHaveLength(1);

    expect((await world.as(TEACHER_A).remove.execute({ id: created.id })).isOk()).toBe(true);
    expect(
      (await world.as(TEACHER_A).overview.execute('class-a'))._unsafeUnwrap().assignments,
    ).toEqual([]);
    expect(world.auditEvents.map(({ type }) => type)).toEqual([
      'assignment.created',
      'assignment.updated',
      'assignment.deleted',
    ]);
    expect(JSON.stringify(world.auditEvents)).not.toContain(DRAFT.solutionKey);
    expect(JSON.stringify(world.auditEvents)).not.toContain(DRAFT.title);
  });

  it('refuses invalid content field by field and stores nothing', async () => {
    const world = createWorld();
    const result = await world.as(TEACHER_A).create.execute({
      classroomId: 'class-a',
      title: '   ',
      taskText: 'x'.repeat(4001),
      dueDate: '2026-02-30',
      solutionKey: '',
    });
    expect(
      result.isErr() && result.error.kind === 'validation' && result.error.fieldErrors,
    ).toEqual({
      title: ['assignments.validation.title_required'],
      taskText: ['assignments.validation.task_too_long'],
      dueDate: ['assignments.validation.date_invalid'],
    });
    expect(world.rows.size).toBe(0);
  });

  it('refuses a past due date on create and when the date is changed', async () => {
    const world = createWorld();
    const past = await world.as(TEACHER_A).create.execute({
      ...DRAFT,
      classroomId: 'class-a',
      dueDate: '2026-10-24',
    });
    expect(past.isErr() && past.error.kind === 'validation' && past.error.fieldErrors).toEqual({
      dueDate: ['assignments.validation.date_past'],
    });
    expect(world.rows.size).toBe(0);

    const created = (
      await world.as(TEACHER_A).create.execute({ ...DRAFT, classroomId: 'class-a' })
    )._unsafeUnwrap();
    const moved = await world
      .as(TEACHER_A)
      .update.execute({ ...DRAFT, id: created.id, dueDate: '2026-10-01' });
    expect(moved.isErr()).toBe(true);
  });

  it('only posts to an own, active class', async () => {
    const world = createWorld();
    const foreign = await world.as(TEACHER_A).create.execute({ ...DRAFT, classroomId: 'class-b' });
    expect(foreign.isErr() && foreign.error.code).toBe('classroom.not_found');
    const archived = await world
      .as(TEACHER_A)
      .create.execute({ ...DRAFT, classroomId: 'class-a-old' });
    expect(archived.isErr() && archived.error.code).toBe('assignments.classroom_archived');
    expect(world.rows.size).toBe(0);
  });

  it("keeps Teacher B away from Teacher A's class and assignments", async () => {
    const world = createWorld();
    const created = await postAs(world);
    const asB = world.as(TEACHER_B);

    const overview = (await asB.overview.execute('class-a'))._unsafeUnwrap();
    expect(overview.selectedClassroomId).toBe('class-b');
    expect(overview.classrooms.map(({ id }) => id)).toEqual(['class-b']);
    expect(overview.assignments).toEqual([]);

    const update = await asB.update.execute({ ...DRAFT, id: created.id, title: 'Hijacked' });
    expect(update.isErr() && update.error.code).toBe('auth.permission_denied');
    const removal = await asB.remove.execute({ id: created.id });
    expect(removal.isErr() && removal.error.code).toBe('auth.permission_denied');
    expect(world.rows.get(created.id)?.title).toBe(DRAFT.title);
  });

  it('refuses every teacher operation to a parent before touching storage', async () => {
    const world = createWorld();
    const created = await postAs(world);
    const asParent = world.as(PARENT);

    for (const result of [
      await asParent.overview.execute(undefined),
      await asParent.create.execute({ ...DRAFT, classroomId: 'class-a' }),
      await asParent.update.execute({ ...DRAFT, id: created.id }),
      await asParent.remove.execute({ id: created.id }),
    ]) {
      expect(result.isErr() && result.error.code).toBe('auth.permission_denied');
    }
    expect([...world.rows.keys()]).toEqual([created.id]);
  });

  it('reports an unknown assignment as not found', async () => {
    const world = createWorld();
    const result = await world.as(TEACHER_A).remove.execute({ id: 'missing' });
    expect(result.isErr() && result.error.code).toBe('assignments.not_found');
  });

  it('falls back to the newest active class and skips archived ones', async () => {
    const world = createWorld();
    const overview = (await world.as(TEACHER_A).overview.execute('class-a-old'))._unsafeUnwrap();
    expect(overview.selectedClassroomId).toBe('class-a');
    expect(overview.classrooms.map(({ id }) => id)).not.toContain('class-a-old');
  });
});

describe('child assignment list', () => {
  it("shows a parent's child only its own class's assignments, without the solution key", async () => {
    const world = createWorld();
    const inClass = await postAs(world, 'class-a');
    await postAs(world, 'class-a2');
    await world.as(TEACHER_B).create.execute({ ...DRAFT, classroomId: 'class-b' });

    const tasks = (await world.as(PARENT).childTasks.execute('child-in-a'))._unsafeUnwrap();
    expect(tasks).toEqual([
      { id: inClass.id, title: DRAFT.title, taskText: DRAFT.taskText, dueDate: DRAFT.dueDate },
    ]);
    expect(JSON.stringify(tasks)).not.toContain(DRAFT.solutionKey);
    expect(tasks[0]).not.toHaveProperty('solutionKey');
  });

  it('refuses another parent and every teacher, and lists nothing for a child without a class', async () => {
    const world = createWorld();
    await postAs(world);

    const foreign = await world.as(OTHER_PARENT).childTasks.execute('child-in-a');
    expect(foreign.isErr() && foreign.error.code).toBe('auth.permission_denied');
    const teacher = await world.as(TEACHER_A).childTasks.execute('child-in-a');
    expect(teacher.isErr() && teacher.error.code).toBe('auth.permission_denied');
    const noClass = await world.as(PARENT).childTasks.execute('child-without-class');
    expect(noClass._unsafeUnwrap()).toEqual([]);
  });
});
