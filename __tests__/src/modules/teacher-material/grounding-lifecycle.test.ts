import { expect, it } from 'vitest';

import { FindRelevantCompetencies } from '@modules/curriculum/application/queries/find-relevant-competencies';
import { extractStatements } from '@modules/curriculum/domain/parsing/extract-statements';
import { ClassroomTeacherMaterialSource } from '@modules/curriculum/infrastructure/teacher-material/classroom-teacher-material-source';
import { BeginMaterialUpload } from '@modules/teacher-material/application/commands/begin-material-upload';
import { CompleteMaterialUpload } from '@modules/teacher-material/application/commands/complete-material-upload';
import { DeleteMaterial } from '@modules/teacher-material/application/commands/delete-material';

import { okAsync } from '@lib/result';

import { world } from './world';

it('grounds only the class member, marks teacher text untrusted, and stops immediately after deletion', async () => {
  const w = world();
  const deps = { ...w.deps, ingest: { extract: extractStatements } };
  await new BeginMaterialUpload(deps).execute(w.input);
  await new CompleteMaterialUpload(deps).execute('material-1');
  const teacherMaterial = new ClassroomTeacherMaterialSource({
    childClassroom: {
      execute: (id) => okAsync({ classroomId: id === 'child-1' ? 'class-1' : 'class-2' }),
    },
    list: () =>
      okAsync(
        [...w.sections.entries()].flatMap(([materialId, statements]) =>
          statements.map((statement) => ({ ...statement, materialId, materialTitle: 'Zahlen' })),
        ),
      ),
  });
  const query = new FindRelevantCompetencies({
    competencies: {
      listCandidates: () => okAsync([]),
      saveDocument: () => okAsync('created'),
      findByCodes: () => okAsync([]),
    },
    teacherMaterial,
    audit: { record: () => undefined },
  });
  const request = {
    federalState: 'he',
    grade: 3,
    subject: 'math',
    task: 'Zahlen vergleichen und ordnen',
    classroomId: 'class-1',
  };
  const own = (await query.execute({ ...request, childProfileId: 'child-1' }))._unsafeUnwrap();
  expect(own.competencies).toHaveLength(1);
  expect(own.competencies[0]).toMatchObject({
    origin: 'teacher-material',
    source: { key: 'material:material-1', title: 'Zahlen', url: null },
  });
  expect(
    (await query.execute({ ...request, childProfileId: 'child-2' }))._unsafeUnwrap().competencies,
  ).toEqual([]);
  expect((await query.execute(request))._unsafeUnwrap().competencies).toEqual([]);
  await new DeleteMaterial(deps).execute('material-1');
  expect(
    (await query.execute({ ...request, childProfileId: 'child-1' }))._unsafeUnwrap().competencies,
  ).toEqual([]);
});
