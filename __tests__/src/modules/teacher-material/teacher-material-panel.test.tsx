import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TeacherMaterialPanel } from '@modules/teacher-material/presentation/components/teacher-material-panel';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const list = vi.hoisted(() => vi.fn());
vi.mock('@modules/teacher-material/composition', () => ({
  materialQueries: { listMaterials: { execute: list } },
}));
vi.mock('@modules/teacher-material/presentation/components/teacher-material-section', () => ({
  TeacherMaterialSection: ({
    classroomId,
    materials,
  }: {
    classroomId: string;
    materials: readonly unknown[];
  }) => (
    <p>
      section {classroomId} {materials.length}
    </p>
  ),
}));

describe('teacher material panel', () => {
  beforeEach(() => {
    list.mockReset();
  });

  it('shows the section with the class teacher’s own material', async () => {
    list.mockReturnValue(okAsync([{ id: 'material-1' }]));
    render(await TeacherMaterialPanel({ classroomId: 'class-1' }));
    expect(list).toHaveBeenCalledWith('class-1');
    expect(screen.getByText('section class-1 1')).toBeVisible();
  });

  it('hides the section for anyone who does not own the class', async () => {
    list.mockReturnValue(errAsync(forbiddenError('auth.permission_denied', 'Denied')));
    expect(await TeacherMaterialPanel({ classroomId: 'class-2' })).toBeNull();
  });
});
