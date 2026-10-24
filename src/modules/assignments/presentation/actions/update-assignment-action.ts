'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { assignmentsCommands } from '../../composition';
import { toTeacherAssignmentDto } from '../dto/teacher-assignment-dto';
import { TEACHER_ASSIGNMENTS_ROUTE_PATTERN } from '../routes';
import { updateAssignmentSchema } from '../schemas/assignment-draft-schema';
import { parseAssignmentsInput } from '../schemas/parse-assignments-input';

import type { TeacherAssignmentDto } from '../dto/teacher-assignment-dto';

/** Replaces the content of one of the signed-in teacher's own assignments. */
export async function updateAssignmentAction(
  input: unknown,
): Promise<ActionResult<TeacherAssignmentDto>> {
  const result = await parseAssignmentsInput(updateAssignmentSchema, input).asyncAndThen(
    (command) => assignmentsCommands.updateAssignment.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(TEACHER_ASSIGNMENTS_ROUTE_PATTERN, 'page');
  }
  return toActionResult(result.map(toTeacherAssignmentDto));
}
