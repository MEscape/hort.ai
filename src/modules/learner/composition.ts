import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';

import { CreateChildProfile } from './application/commands/create-child-profile';
import { DeleteChildProfile } from './application/commands/delete-child-profile';
import { UpdateChildProfile } from './application/commands/update-child-profile';
import { GetChildProfileById } from './application/queries/get-child-profile-by-id';
import { ListChildProfiles } from './application/queries/list-child-profiles';
import { loggerLearnerAuditLog } from './infrastructure/audit/logger-learner-audit-log';
import { PrismaChildProfileRepository } from './infrastructure/prisma/prisma-child-profile.repository';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error.
 */
const childProfiles = new PrismaChildProfileRepository(systemClock);
const authorization = getAccessControl();
const dependencies = { authorization, childProfiles, audit: loggerLearnerAuditLog };

export const learnerCommands = {
  createChildProfile: new CreateChildProfile(dependencies),
  updateChildProfile: new UpdateChildProfile(dependencies),
  deleteChildProfile: new DeleteChildProfile(dependencies),
} as const;

export const learnerQueries = {
  getChildProfileById: new GetChildProfileById(dependencies),
  listChildProfiles: new ListChildProfiles(dependencies),
} as const;
