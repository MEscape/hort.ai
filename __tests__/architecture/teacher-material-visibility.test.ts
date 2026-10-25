import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const page = readFileSync(
  join(process.cwd(), 'src/app/[locale]/(app)/teacher/assignments/page.tsx'),
  'utf8',
);

describe('teacher assignments material visibility', () => {
  it('does not expose the unfinished class material upload', () => {
    expect(page).not.toContain('TeacherMaterialPanel');
    expect(page).not.toContain('teacherMaterial');
  });

  it('keeps the classroom and assignment workspace available', () => {
    expect(page).toContain('<TeacherAssignmentWorkspace');
    expect(page).toContain('<ClassroomDetails');
    expect(page).toContain('<CreateClassroomForm');
  });
});
