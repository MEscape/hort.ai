import { describe, expect, it } from 'vitest';

import { toChildAssignment } from '@modules/assignments/domain/models/assignment';
import {
  toAssignment,
  toAssignmentCreateData,
} from '@modules/assignments/infrastructure/prisma/assignment-record-mapper';

const record = {
  id: 'assignment-1',
  tenantId: 'tenant-1',
  ownerId: 'teacher-1',
  classroomId: 'class-1',
  title: 'Eine Aufgabe',
  taskText: 'Beschreibe deinen Rechenweg.',
  dueDate: '2026-10-25',
  solutionKey: 'Nur für die Lehrkraft',
  createdAt: { epochMilliseconds: Date.parse('2026-10-24T12:00:00Z') },
  updatedAt: { epochMilliseconds: Date.parse('2026-10-24T13:00:00Z') },
};

describe('assignment persistence mapping', () => {
  it('maps the stored taskText to the domain text and keeps UTC instants', () => {
    const assignment = toAssignment(record);
    expect(assignment.text).toBe(record.taskText);
    expect(assignment.createdAt.toISOString()).toBe('2026-10-24T12:00:00.000Z');
    expect(assignment.updatedAt.toISOString()).toBe('2026-10-24T13:00:00.000Z');
    expect(assignment.solutionKey).toBe(record.solutionKey);
  });

  it('maps a domain draft to the existing taskText storage column', () => {
    expect(
      toAssignmentCreateData({
        title: record.title,
        text: record.taskText,
        dueDate: null,
        solutionKey: null,
      }),
    ).toEqual({ title: record.title, taskText: record.taskText, dueDate: null, solutionKey: null });
  });

  it('constructs a child projection that never contains the solution or account scope', () => {
    const view = toChildAssignment(toAssignment(record));
    expect(view).toEqual({
      id: record.id,
      classroomId: record.classroomId,
      title: record.title,
      text: record.taskText,
      dueDate: record.dueDate,
    });
    expect(JSON.stringify(view)).not.toContain(record.solutionKey);
    expect(view).not.toHaveProperty('ownerId');
    expect(view).not.toHaveProperty('tenantId');
  });
});
