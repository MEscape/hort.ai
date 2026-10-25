import { buildQueryString } from '@lib/utils';

/**
 * The teacher's assignment screen, in one place so actions (cache invalidation) and pages
 * (sign-in return path, class selection) cannot drift apart.
 */
export const assignmentRoutes = {
  teacher: () => '/teacher/assignments',
  teacherClassroom: (classroomId: string) =>
    `/teacher/assignments${buildQueryString({ classroom: classroomId })}`,
} as const;

/**
 * `revalidatePath` matches the route file structure, not the visible URL, so the locale segment is
 * named as a pattern and every language's page is refreshed.
 */
export const TEACHER_ASSIGNMENTS_ROUTE_PATTERN = '/[locale]/teacher/assignments';
