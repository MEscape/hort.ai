'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toClassroomWithInviteCodeDto } from '../dto/classroom-dto';
import { classroomRoutes } from '../routes';
import { newClassroomSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ClassroomWithInviteCodeDto } from '../dto/classroom-dto';

export async function createClassroomAction(
  input: unknown,
): Promise<ActionResult<ClassroomWithInviteCodeDto>> {
  const result = await parseClassroomInput(newClassroomSchema, input).asyncAndThen((command) =>
    classroomCommands.createClassroom.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(classroomRoutes.list());
  }
  return toActionResult(result.map(toClassroomWithInviteCodeDto));
}
