import { expect, it } from 'vitest';

import { toClassroomId, toChildProfileId } from '@modules/curriculum/domain/models/ids';
import { ClassroomTeacherMaterialSource } from '@modules/curriculum/infrastructure/teacher-material/classroom-teacher-material-source';

import { okAsync } from '@lib/result';

it('requires the actual child membership; missing context or another class returns no material', async () => {
  const statement = {
    code: 's01',
    text: 'Zahlen vergleichen',
    section: null,
    page: null,
    materialId: 'm1',
    materialTitle: 'Zahlen',
  };
  const source = new ClassroomTeacherMaterialSource({
    childClassroom: {
      execute: (id: string) =>
        okAsync(id === 'child-1' ? { classroomId: 'class-1' } : { classroomId: 'class-2' }),
    },
    list: () => okAsync([statement]),
  });
  const classroomId = toClassroomId('class-1');
  expect((await source.listForClassroom(classroomId, 10))._unsafeUnwrap()).toEqual([]);
  expect(
    (await source.listForClassroom(classroomId, 10, toChildProfileId('child-2')))._unsafeUnwrap(),
  ).toEqual([]);
  expect(
    (await source.listForClassroom(classroomId, 10, toChildProfileId('child-1')))._unsafeUnwrap(),
  ).toEqual([statement]);
});
