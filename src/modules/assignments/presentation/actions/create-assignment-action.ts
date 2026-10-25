'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { assignmentsCommands } from '../../composition';
import { toTeacherAssignmentDto } from '../dto/teacher-assignment-dto';
import { TEACHER_ASSIGNMENTS_ROUTE_PATTERN } from '../routes';
import { newAssignmentSchema } from '../schemas/assignment-draft-schema';
import { parseAssignmentsInput } from '../schemas/parse-assignments-input';

import type { TeacherAssignmentDto } from '../dto/teacher-assignment-dto';

/** Posts an assignment to one of the signed-in teacher's classes; the use case authorizes it. */
export async function createAssignmentAction(
  input: unknown,
): Promise<ActionResult<TeacherAssignmentDto>> {
  const result = await parseAssignmentsInput(newAssignmentSchema, input).asyncAndThen((command) =>
    assignmentsCommands.createAssignment.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(TEACHER_ASSIGNMENTS_ROUTE_PATTERN, 'page');
  }
  return toActionResult(result.map(toTeacherAssignmentDto));
}
