'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toClassroomDto } from '../dto/classroom-dto';
import { classroomRoutes } from '../routes';
import { renameClassroomSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ClassroomDto } from '../dto/classroom-dto';

/** @keep Server Action for the class screens (teacher: create/rename/archive/new code; parent: join/leave), wired by the UI work. */
export async function renameClassroomAction(input: unknown): Promise<ActionResult<ClassroomDto>> {
  const result = await parseClassroomInput(renameClassroomSchema, input).asyncAndThen((command) =>
    classroomCommands.renameClassroom.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(classroomRoutes.list());
    revalidatePath(classroomRoutes.detail(result.value.id));
  }
  return toActionResult(result.map(toClassroomDto));
}
