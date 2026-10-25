import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_LIMITS,
  createAssignmentDraft,
} from '@modules/assignments/domain/models/assignment';

const context = { today: '2026-10-25' };
const valid = { title: 'Titel', text: 'Aufgabe', dueDate: '', solutionKey: '' };

describe('createAssignmentDraft', () => {
  it('trims the text and stores an empty due date and solution key as none', () => {
    expect(
      createAssignmentDraft(
        { ...valid, title: '  Titel  ', solutionKey: '   ' },
        context,
      )._unsafeUnwrap(),
    ).toEqual({ title: 'Titel', text: 'Aufgabe', dueDate: null, solutionKey: null });
  });

  it.each(['2026-02-29', '2026-13-01', '2026-02-30', '26-01-01', '2026-1-1'])(
    'refuses %s, which is not a real calendar day',
    (dueDate) => {
      const result = createAssignmentDraft({ ...valid, dueDate }, context);
      expect(
        result.isErr() && result.error.kind === 'validation' && result.error.fieldErrors,
      ).toEqual({ dueDate: ['assignments.validation.date_invalid'] });
    },
  );

  it('refuses a due date before today but accepts today and later', () => {
    const past = createAssignmentDraft({ ...valid, dueDate: '2026-10-24' }, context);
    expect(past.isErr() && past.error.kind === 'validation' && past.error.fieldErrors).toEqual({
      dueDate: ['assignments.validation.date_past'],
    });
    expect(createAssignmentDraft({ ...valid, dueDate: '2026-10-25' }, context).isOk()).toBe(true);
    expect(createAssignmentDraft({ ...valid, dueDate: '2026-10-26' }, context).isOk()).toBe(true);
  });

  it('keeps an already saved past date when it is not changed', () => {
    const kept = { ...context, currentDueDate: '2026-10-01' };
    expect(createAssignmentDraft({ ...valid, dueDate: '2026-10-01' }, kept).isOk()).toBe(true);
    expect(createAssignmentDraft({ ...valid, dueDate: '2026-10-02' }, kept).isErr()).toBe(true);
  });

  it('accepts a leap day and the exact limits', () => {
    const draft = createAssignmentDraft(
      {
        title: 't'.repeat(ASSIGNMENT_LIMITS.title),
        text: 'x'.repeat(ASSIGNMENT_LIMITS.taskText),
        dueDate: '2028-02-29',
        solutionKey: 's'.repeat(ASSIGNMENT_LIMITS.solutionKey),
      },
      context,
    );
    expect(draft.isOk()).toBe(true);
  });

  it('reports every field that is over its limit', () => {
    const result = createAssignmentDraft(
      {
        title: 't'.repeat(ASSIGNMENT_LIMITS.title + 1),
        text: 'x',
        dueDate: '',
        solutionKey: 's'.repeat(ASSIGNMENT_LIMITS.solutionKey + 1),
      },
      context,
    );
    expect(
      result.isErr() && result.error.kind === 'validation' && result.error.fieldErrors,
    ).toEqual({
      title: ['assignments.validation.title_too_long'],
      solutionKey: ['assignments.validation.solution_too_long'],
    });
  });
});
