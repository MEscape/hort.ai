'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toClassroomWithInviteCodeDto } from '../dto/classroom-dto';
import { classroomRoutes } from '../routes';
import { classroomIdSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ClassroomWithInviteCodeDto } from '../dto/classroom-dto';

/** @keep Server Action for the class screens (teacher: create/rename/archive/new code; parent: join/leave), wired by the UI work. */
export async function regenerateInviteCodeAction(
  input: unknown,
): Promise<ActionResult<ClassroomWithInviteCodeDto>> {
  const result = await parseClassroomInput(classroomIdSchema, input).asyncAndThen((command) =>
    classroomCommands.regenerateInviteCode.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(classroomRoutes.detail(result.value.classroom.id));
  }
  return toActionResult(result.map(toClassroomWithInviteCodeDto));
}
