import 'server-only';
import { headers } from 'next/headers';

import { getAccessControl } from '@modules/auth';
import { learnerCommands, learnerQueries } from '@modules/learner';

import { systemClock } from '@lib/clock';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';

import { ArchiveClassroom } from './application/commands/archive-classroom';
import { CreateClassroom } from './application/commands/create-classroom';
import { JoinClassroom } from './application/commands/join-classroom';
import { LeaveClassroom } from './application/commands/leave-classroom';
import { RegenerateInviteCode } from './application/commands/regenerate-invite-code';
import { RenameClassroom } from './application/commands/rename-classroom';
import { GetChildClassroom } from './application/queries/get-child-classroom';
import { GetClassroomById } from './application/queries/get-classroom-by-id';
import { ListClassroomMembers } from './application/queries/list-classroom-members';
import { ListClassrooms } from './application/queries/list-classrooms';
import { loggerClassroomAuditLog } from './infrastructure/audit/logger-classroom-audit-log';
import { LearnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';
import { PrismaClassroomRepository } from './infrastructure/prisma/prisma-classroom.repository';
import { cryptoInviteCodeIssuer } from './infrastructure/security/crypto-invite-code-issuer';

import type { ClassroomDependencies } from './application/classroom-dependencies';

/**
 * The module's composition root: the one file that knows both the application use cases and their
 * infrastructure adapters, and the only place the learner module is wired in. `server-only` makes
 * an accidental import from a Client Component a build error.
 */
const dependencies: ClassroomDependencies = {
  authorization: getAccessControl(),
  classrooms: new PrismaClassroomRepository(systemClock),
  inviteCodes: cryptoInviteCodeIssuer,
  childProfiles: new LearnerChildProfileAccess({
    getChildProfileById: learnerQueries.getChildProfileById,
    updateChildProfile: learnerCommands.updateChildProfile,
  }),
  audit: loggerClassroomAuditLog,
  rateLimiter: getRateLimiter(),
  clientAddress: getClientAddressProvider(() => headers()),
};

export const classroomCommands = {
  createClassroom: new CreateClassroom(dependencies),
  renameClassroom: new RenameClassroom(dependencies),
  archiveClassroom: new ArchiveClassroom(dependencies),
  regenerateInviteCode: new RegenerateInviteCode(dependencies),
  joinClassroom: new JoinClassroom(dependencies),
  leaveClassroom: new LeaveClassroom(dependencies),
} as const;

export const classroomQueries = {
  listClassrooms: new ListClassrooms(dependencies),
  getClassroomById: new GetClassroomById(dependencies),
  listClassroomMembers: new ListClassroomMembers(dependencies),
  getChildClassroom: new GetChildClassroom(dependencies),
} as const;
