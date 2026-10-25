import { describe, expect, it } from 'vitest';

import { toChildProfileId, toClassroomId } from '@modules/assignments/domain/models/ids';
import { ClassroomModuleAccess } from '@modules/assignments/infrastructure/classroom/classroom-module-access';
import type { ClassroomView } from '@modules/classroom';

import { forbiddenError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const view = (id: string, status: ClassroomView['status']): ClassroomView => ({
  id,
  name: `Klasse ${id}`,
  federalState: 'he',
  grade: 3,
  subject: 'math',
  status,
  inviteCodeIssuedAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe('ClassroomModuleAccess', () => {
  it("passes the classroom module's own decisions through unchanged", async () => {
    const access = new ClassroomModuleAccess({
      listClassrooms: { execute: () => okAsync([view('a', 'active'), view('b', 'archived')]) },
      getClassroomById: {
        execute: () => errAsync(notFoundError('classroom.not_found', 'not found')),
      },
      getChildClassroom: {
        execute: () => errAsync(forbiddenError('auth.permission_denied', 'denied')),
      },
    });

    expect((await access.listOwnClassrooms())._unsafeUnwrap()).toEqual([
      { id: 'a', name: 'Klasse a', grade: 3, isActive: true },
      { id: 'b', name: 'Klasse b', grade: 3, isActive: false },
    ]);
    const own = await access.requireOwnClassroom(toClassroomId('foreign'));
    expect(own.isErr() && own.error.code).toBe('classroom.not_found');
    const child = await access.findClassroomOfChild(toChildProfileId('foreign-child'));
    expect(child.isErr() && child.error.code).toBe('auth.permission_denied');
  });

  it("returns only the class id of a child's membership, or null without one", async () => {
    const membership = {
      classroomId: 'a',
      name: 'Klasse a',
      federalState: 'he' as const,
      grade: 3,
      subject: 'math' as const,
      joinedAt: new Date(0),
    };
    const answers = [membership, null];
    const access = new ClassroomModuleAccess({
      listClassrooms: { execute: () => okAsync([]) },
      getClassroomById: { execute: () => okAsync(view('a', 'active')) },
      getChildClassroom: { execute: () => okAsync(answers.shift() ?? null) },
    });
    expect((await access.findClassroomOfChild(toChildProfileId('c')))._unsafeUnwrap()).toBe('a');
    expect((await access.findClassroomOfChild(toChildProfileId('c')))._unsafeUnwrap()).toBeNull();
  });
});
