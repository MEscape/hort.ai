import { z } from 'zod';

/** Long enough for any id the server issues; the use case parses it again. */
const ID_PARAM_MAX = 128;

/**
 * Search parameters are untrusted and may be repeated (`?a=1&a=2` arrives as an array), so each
 * page parses them instead of casting (validation.md). A bad value is dropped, never an error:
 * a hand-edited address shows the plain page.
 */
const idParam = z.string().min(1).max(ID_PARAM_MAX).optional().catch(undefined);

const teacherPageSchema = z.object({ classroom: idParam, details: idParam });
const childTasksSchema = z.object({ child: idParam });

/**
 * `classroom` selects one of the teacher's classes; anything else falls back to the newest.
 * `details` opens a class's details dialog; the classroom query checks it is the teacher's own.
 */
export function parseTeacherAssignmentsPageParams(raw: unknown): {
  readonly classroomId: string | undefined;
  readonly detailsClassroomId: string | undefined;
} {
  const parsed = teacherPageSchema.parse(raw);
  return { classroomId: parsed.classroom, detailsClassroomId: parsed.details };
}

/** `child` names the signed-in parent's child whose class's assignments the start screen lists. */
export function parseChildTasksPageParams(raw: unknown): {
  readonly childProfileId: string | undefined;
} {
  return { childProfileId: childTasksSchema.parse(raw).child };
}
