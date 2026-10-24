import 'server-only';

import { getAccessControl } from '@modules/auth';
import { classroomQueries } from '@modules/classroom';

import { IngestCurriculumDocument } from './application/commands/ingest-curriculum-document';
import { FindRelevantCompetencies } from './application/queries/find-relevant-competencies';
import { extractStatements } from './domain/parsing/extract-statements';
import { loggerCurriculumAuditLog } from './infrastructure/audit/logger-curriculum-audit-log';
import { PrismaCompetencyRepository } from './infrastructure/prisma/prisma-competency.repository';
import { PrismaTeacherMaterialRepository } from './infrastructure/prisma/prisma-teacher-material.repository';
import { ClassroomTeacherMaterialSource } from './infrastructure/teacher-material/classroom-teacher-material-source';

const materialRepository = new PrismaTeacherMaterialRepository();

/** Public curriculum plus private material, re-authorized against the child's actual class. */
const dependencies = {
  competencies: new PrismaCompetencyRepository(),
  teacherMaterial: new ClassroomTeacherMaterialSource({
    childClassroom: classroomQueries.getChildClassroom,
    list: (classroomId, limit, childProfileId) =>
      getAccessControl()
        .requireInTenant('learner.read')
        .andThen((actor) =>
          materialRepository.list({
            classroomId,
            limit,
            childProfileId,
            tenantId: actor.tenantId,
            ownerId: actor.id,
          }),
        ),
  }),
  audit: loggerCurriculumAuditLog,
};

export const curriculumCommands = {
  ingestCurriculumDocument: new IngestCurriculumDocument(dependencies),
} as const;

export const curriculumQueries = {
  findRelevantCompetencies: new FindRelevantCompetencies(dependencies),
} as const;

/**
 * The extraction step of the pipeline, for teacher material (#29): text in, short bounded
 * statements with section and page out. #29 stores them as `MaterialSection` rows of one class.
 */
export const curriculumText = {
  extractStatements,
} as const;
