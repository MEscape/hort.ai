'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toChildClassroomDto } from '../dto/classroom-dto';
import { joinClassroomSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ChildClassroomDto } from '../dto/classroom-dto';

/** @keep Server Action for the class screens (teacher: create/rename/archive/new code; parent: join/leave), wired by the UI work. */
export async function joinClassroomAction(
  input: unknown,
): Promise<ActionResult<ChildClassroomDto>> {
  const result = await parseClassroomInput(joinClassroomSchema, input).asyncAndThen((command) =>
    classroomCommands.joinClassroom.execute(command),
  );
  return toActionResult(result.map(toChildClassroomDto));
}
