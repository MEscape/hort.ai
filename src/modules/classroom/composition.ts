import 'server-only';
import { headers } from 'next/headers';

import { getAccessControl, getParentAreaServices } from '@modules/auth';
import { getLearnerCommands, getLearnerQueries } from '@modules/learner';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';

import { ArchiveClassroom } from './application/commands/archive-classroom';
import { CreateClassroom } from './application/commands/create-classroom';
import { JoinClassroom } from './application/commands/join-classroom';
import { LeaveClassroom } from './application/commands/leave-classroom';
import { RegenerateInviteCode } from './application/commands/regenerate-invite-code';
import { RenameClassroom } from './application/commands/rename-classroom';
import { GetChildClassroom } from './application/queries/get-child-classroom';
import { GetClassroomById } from './application/queries/get-classroom-by-id';
import { GetClassroomDetails } from './application/queries/get-classroom-details';
import { ListClassroomMembers } from './application/queries/list-classroom-members';
import { ListClassrooms } from './application/queries/list-classrooms';
import { requiringParentProof } from './application/services/parent-proof';
import { loggerClassroomAuditLog } from './infrastructure/audit/logger-classroom-audit-log';
import { LearnerChildProfileAccess } from './infrastructure/learner/learner-child-profile-access';
import { PrismaClassroomRepository } from './infrastructure/prisma/prisma-classroom.repository';
import { createAesGcmInviteCodeVault } from './infrastructure/security/aes-gcm-invite-code-vault';
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
  inviteCodeVault: createAesGcmInviteCodeVault(serverEnv.CLASSROOM_INVITE_CODE_KEY),
  childProfiles: new LearnerChildProfileAccess({
    // The learner module builds its use cases on first use; resolve them per call, not at import.
    getChildProfileById: { execute: (id) => getLearnerQueries().getChildProfileById.execute(id) },
    adoptSchoolSettings: {
      execute: (input) => getLearnerCommands().adoptSchoolSettings.execute(input),
    },
  }),
  audit: loggerClassroomAuditLog,
  rateLimiter: getRateLimiter(),
  clientAddress: getClientAddressProvider(() => headers()),
  clock: systemClock,
};

/** Adult-only actions on a child also need the short-lived parent-area password proof. */
const parentDependencies: ClassroomDependencies = {
  ...dependencies,
  authorization: requiringParentProof(dependencies.authorization, () =>
    getParentAreaServices().require.execute(),
  ),
};

export const classroomCommands = {
  createClassroom: new CreateClassroom(dependencies),
  renameClassroom: new RenameClassroom(dependencies),
  archiveClassroom: new ArchiveClassroom(dependencies),
  regenerateInviteCode: new RegenerateInviteCode(dependencies),
  joinClassroom: new JoinClassroom(parentDependencies),
  leaveClassroom: new LeaveClassroom(parentDependencies),
} as const;

export const classroomQueries = {
  listClassrooms: new ListClassrooms(dependencies),
  getClassroomById: new GetClassroomById(dependencies),
  getClassroomDetails: new GetClassroomDetails(dependencies),
  listClassroomMembers: new ListClassroomMembers(dependencies),
  getChildClassroom: new GetChildClassroom(dependencies),
} as const;
