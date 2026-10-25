'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { assignmentsCommands } from '../../composition';
import { TEACHER_ASSIGNMENTS_ROUTE_PATTERN } from '../routes';
import { assignmentIdSchema } from '../schemas/assignment-draft-schema';
import { parseAssignmentsInput } from '../schemas/parse-assignments-input';

/** Deletes one of the signed-in teacher's own assignments. */
export async function deleteAssignmentAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseAssignmentsInput(assignmentIdSchema, input).asyncAndThen((command) =>
    assignmentsCommands.deleteAssignment.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(TEACHER_ASSIGNMENTS_ROUTE_PATTERN, 'page');
  }
  return toActionResult(result);
}
