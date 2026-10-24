'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { childProfileIdSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

export async function leaveClassroomAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseClassroomInput(childProfileIdSchema, input).asyncAndThen((command) =>
    classroomCommands.leaveClassroom.execute(command),
  );
  return toActionResult(result);
}
