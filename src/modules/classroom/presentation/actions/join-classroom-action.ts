'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { toChildClassroomDto } from '../dto/classroom-dto';
import { joinClassroomSchema } from '../schemas/classroom-schemas';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

import type { ChildClassroomDto } from '../dto/classroom-dto';

export async function joinClassroomAction(
  input: unknown,
): Promise<ActionResult<ChildClassroomDto>> {
  const result = await parseClassroomInput(joinClassroomSchema, input).asyncAndThen((command) =>
    classroomCommands.joinClassroom.execute(command),
  );
  return toActionResult(result.map(toChildClassroomDto));
}
