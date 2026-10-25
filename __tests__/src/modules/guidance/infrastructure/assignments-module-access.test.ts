import { describe, expect, it } from 'vitest';

import { toAssignmentId, toChildProfileId } from '@modules/guidance/domain/models/ids';
import type { AssignmentAccessError } from '@modules/guidance/domain/ports/assignment-access.port';
import { AssignmentsModuleAccess } from '@modules/guidance/infrastructure/assignments/assignments-module-access';

import { forbiddenError, infrastructureError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const CHILD = toChildProfileId('child-1');
const ASSIGNMENT = toAssignmentId('assignment-1');

function accessAnswering(
  answer: { readonly fails: AssignmentAccessError } | { readonly key: string | null },
) {
  const asked: unknown[] = [];
  const access = new AssignmentsModuleAccess({
    execute: (input) => {
      asked.push(input);
      return 'fails' in answer
        ? errAsync(answer.fails)
        : okAsync({ id: ASSIGNMENT, taskText: 'Rechne 36 + 47.', solutionKey: answer.key });
    },
  });
  return { access, asked };
}

describe('AssignmentsModuleAccess (#33)', () => {
  it("asks the assignments module for the child's assignment and keeps text and key", async () => {
    const { access, asked } = accessAnswering({ key: '83' });

    const found = await access.findForChild(CHILD, ASSIGNMENT);

    expect(found._unsafeUnwrap()).toEqual({
      id: ASSIGNMENT,
      text: 'Rechne 36 + 47.',
      solutionKey: '83',
    });
    expect(asked).toEqual([{ childProfileId: CHILD, assignmentId: ASSIGNMENT }]);
  });

  it("turns the assignments module's not found into guidance's own code", async () => {
    const { access } = accessAnswering({
      fails: notFoundError('assignments.not_found', 'Assignment not found.'),
    });

    const error = (await access.findForChild(CHILD, ASSIGNMENT))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'not_found', code: 'guidance.assignment_not_found' });
  });

  it('passes a refusal and an infrastructure failure on unchanged', async () => {
    for (const failure of [
      forbiddenError('auth.permission_denied', 'Denied.'),
      infrastructureError('assignments.persistence_failed', 'Down.'),
    ]) {
      const { access } = accessAnswering({ fails: failure });
      expect((await access.findForChild(CHILD, ASSIGNMENT))._unsafeUnwrapErr()).toBe(failure);
    }
  });
});
