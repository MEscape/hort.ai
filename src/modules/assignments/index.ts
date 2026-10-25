/**
 * Server-side public API of the assignments module. Other modules and framework entry points import
 * from here and nowhere deeper. Components that run in the browser import from `./client`.
 *
 * Teacher storage is reached only through authorized use cases. The child-facing query returns the
 * child projection, which has no solution key.
 */
export { assignmentsQueries } from './composition';
export { assignmentRoutes } from './presentation/routes';
export {
  parseChildTasksPageParams,
  parseTeacherAssignmentsPageParams,
} from './presentation/schemas/page-params-schema';
export { TeacherAssignmentWorkspace } from './presentation/components/teacher-assignment-workspace';
export { FirstClassroomPanel } from './presentation/components/first-classroom-panel';
export { TeachersOnlyNotice } from './presentation/components/teachers-only-notice';
export type {
  ChildAssignmentView,
  TeacherAssignmentOverview,
} from './application/contracts/assignment-views';
export { default as enAssignments } from './presentation/i18n/en.json';
export { default as deAssignments } from './presentation/i18n/de.json';
