import 'server-only';
import { getAccessControl } from '@modules/auth';
import { classroomQueries } from '@modules/classroom';

import { systemClock } from '@lib/clock';

import { CreateAssignment } from './application/commands/create-assignment';
import { DeleteAssignment } from './application/commands/delete-assignment';
import { UpdateAssignment } from './application/commands/update-assignment';
import { GetAssignmentById } from './application/queries/get-assignment-by-id';
import { GetAssignmentForHelp } from './application/queries/get-assignment-for-help';
import { GetTeacherAssignmentOverview } from './application/queries/get-teacher-assignment-overview';
import { ListChildAssignments } from './application/queries/list-child-assignments';
import { loggerAssignmentAuditLog } from './infrastructure/audit/logger-assignment-audit-log';
import { ClassroomModuleAccess } from './infrastructure/classroom/classroom-module-access';
import { PrismaAssignmentRepository } from './infrastructure/prisma/prisma-assignment.repository';

import type { AssignmentsDependencies } from './application/assignments-dependencies';

/**
 * The module's composition root, and the only place the classroom module is wired in. Only use
 * cases leave it; storage and credentials stay internal.
 */
const dependencies: AssignmentsDependencies = {
  authorization: getAccessControl(),
  assignments: new PrismaAssignmentRepository(systemClock),
  classrooms: new ClassroomModuleAccess(classroomQueries),
  audit: loggerAssignmentAuditLog,
};

export const assignmentsQueries = {
  getAssignmentById: new GetAssignmentById(dependencies),
  /** Server-side only: carries the solution key, for the guidance module's help on an assignment (#33). */
  getAssignmentForHelp: new GetAssignmentForHelp(dependencies),
  getTeacherAssignmentOverview: new GetTeacherAssignmentOverview(dependencies),
  listChildAssignments: new ListChildAssignments(dependencies),
} as const;

export const assignmentsCommands = {
  createAssignment: new CreateAssignment(dependencies),
  updateAssignment: new UpdateAssignment(dependencies),
  deleteAssignment: new DeleteAssignment(dependencies),
} as const;
