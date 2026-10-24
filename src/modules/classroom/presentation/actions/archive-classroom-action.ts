'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toClassroomDto } from '../dto/classroom-dto';
import { classroomRoutes } from '../routes';
import { classroomIdSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ClassroomDto } from '../dto/classroom-dto';

export async function archiveClassroomAction(input: unknown): Promise<ActionResult<ClassroomDto>> {
  const result = await parseClassroomInput(classroomIdSchema, input).asyncAndThen((command) =>
    classroomCommands.archiveClassroom.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(classroomRoutes.list());
    revalidatePath(classroomRoutes.detail(result.value.id));
  }
  return toActionResult(result.map(toClassroomDto));
}
