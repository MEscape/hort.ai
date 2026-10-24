import 'server-only';
import { getAccessControl } from '@modules/auth';

import { systemClock } from '@lib/clock';

import { GetAssignmentById } from './application/queries/get-assignment-by-id';
import { PrismaAssignmentRepository } from './infrastructure/prisma/prisma-assignment.repository';

const assignments = new PrismaAssignmentRepository(systemClock);

/** Only use cases leave composition; storage and credentials stay internal. */
export const assignmentsQueries = {
  getAssignmentById: new GetAssignmentById({ authorization: getAccessControl(), assignments }),
} as const;
