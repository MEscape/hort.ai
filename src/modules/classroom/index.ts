/**
 * Server-side public API of the classroom module. Other modules and framework entry points import
 * from here and nowhere deeper. Components that run in the browser import from `./client`.
 */

/**
 * Server-only queries. `getClassroomById` is the teacher-owns-this-class check for material (#29)
 * and assignments (#33); `getChildClassroom` is a child's class for its parent.
 */
export { classroomQueries } from './composition';

export { classroomRoutes } from './presentation/routes';

/** A teacher's first class, rendered by the assignment screen when the teacher has none yet (#33). */
export { CreateClassroomForm } from './presentation/components/create-classroom-form';

export { default as enClassroom } from './presentation/i18n/en.json';
export { default as deClassroom } from './presentation/i18n/de.json';

export { CLASSROOM_ERROR_CODES } from './application/contracts/classroom-constraints';
export type {
  ChildClassroomView,
  ClassMemberView,
  ClassroomView,
  ClassroomWithInviteCodeView,
} from './application/contracts/classroom-views';
export type { ClassroomId } from './domain/models/ids';
