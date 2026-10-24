'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { classroomCommands } from '../../composition';
import { childProfileIdSchema } from '../schemas/classroom-schema';
import { parseClassroomInput } from '../schemas/parse-classroom-input';

/** @keep Server Action for the class screens (teacher: create/rename/archive/new code; parent: join/leave), wired by the UI work. */
export async function leaveClassroomAction(input: unknown): Promise<ActionResult<void>> {
  const result = await parseClassroomInput(childProfileIdSchema, input).asyncAndThen((command) =>
    classroomCommands.leaveClassroom.execute(command),
  );
  return toActionResult(result);
}
