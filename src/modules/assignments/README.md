# Assignments (#33)

A teacher posts work assignments for their class; the children of that class see them on their start screen. Only the teacher authors the content: no AI generates or changes an assignment.

## Routes

- Teacher: `/de/teacher/assignments` and `/en/teacher/assignments` (`?classroom=<id>` selects a class). Signed-out visitors are sent to sign-in and back. `/home` is role-aware: a teacher skips the parent onboarding (#63) and gets a link here; `/onboarding` sends a teacher home.
- Child: the help screen `/help` (`/help?new=1` while another task is open), in the signed-in parent's session, for the parent's onboarded child. It lists the class's assignments as big choices next to the typed task; without a class it shows none. The parent joins a class with the teacher's invite code in the parent area (classroom module `ChildClassroomPanel`, using `joinClassroomAction` / `leaveClassroomAction`).

The development preview (`/dev/teacher-assignments`) is gone; the real route replaced it.

## Use cases

| Use case                       | Permission          | Ownership                                                                                                  |
| ------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GetTeacherAssignmentOverview` | `assignment.read`   | Classes from the classroom module, pinned to the teacher; a foreign `?classroom=` falls back to their own. |
| `CreateAssignment`             | `assignment.create` | Classroom module confirms the class is the teacher's (`getClassroomById`); archived classes refuse.        |
| `UpdateAssignment`             | `assignment.update` | `loadAuthorizedAssignment`: load by tenant, `requireOnResource` on the stored owner; writes stay pinned.   |
| `DeleteAssignment`             | `assignment.delete` | As update.                                                                                                 |
| `ListChildAssignments`         | `learner.read`      | Classroom module checks the child is the parent's and returns its current class (`getChildClassroom`).     |
| `GetAssignmentForHelp`         | `learner.read`      | As `ListChildAssignments`; finds one assignment only in the child's current class, else `not_found` (#33). |

A parent is refused every teacher operation before storage is touched; the teacher screen then shows "For teachers only". Another teacher's assignment is refused with `auth.permission_denied`. Owner and tenant always come from the authorized actor; the action schemas drop any sent by the browser.

The classroom module is reached only through `ClassroomAccess` (domain port), implemented over its public queries in `infrastructure/classroom` and wired in `composition.ts`.

## The solution key

`solutionKey` is teacher-only. The child path never has it: `listForChild` does not select the column, `ChildAssignment` and `ChildAssignmentView` have no such field, and the teacher's preview shows `ChildAssignmentContent` built by an allowlist. It is never put into URLs, browser storage, logs or audit events (ids only). Only the answer check (#14) and the solution-leak guard (#31) read it, on the server: `GetAssignmentForHelp` is the one read that returns it to another module (guidance), and only for an assignment of the class the signed-in parent's child is in now. No action and no page calls it.

## Teacher screen

Overview of the selected class (list, empty state), create, edit, child preview, delete with confirmation. Saving shows progress and announces success in a status line; a refused save keeps the input and marks the fields. Unsaved changes are guarded on reload and need confirmation before leaving the editor. A teacher without an active class creates one inline (classroom module's `CreateClassroomForm`, MVP scope Hessen/mathematics); later classes come from "Add class" beside the class selector, which leaves a draft in the editor as it is. After creating, a dialog shows the class, its invite code (copy button) and how to share it until the teacher closes it (`ClassroomCreationProvider` sits above everything that re-renders once the class exists). Each class's info button opens its details (`?details=<id>`, loaded after the ownership check): the current code or "Code unavailable" for hash-only classes, its expiry, an explicit confirmed "Generate new code", and the children by display name.

Limits (domain, repeated by the database checks): title 120, task text 4,000, solution key 4,000 characters; the due date is an optional ISO calendar date.

## Not done here

- Several children per parent: onboarding (#63) creates one profile, and `/home` links to it. A picker comes with multi-child support.
- Help on a school task in the UI: selecting one shows it and says help is coming. The backend is ready: `StartHelpSession` takes the `assignmentId` (guidance module, see `docs/architecture/help-sessions.md`); the start screen still has to call it (#12).
