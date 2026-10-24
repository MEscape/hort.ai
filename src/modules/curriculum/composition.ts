import 'server-only';

import { IngestCurriculumDocument } from './application/commands/ingest-curriculum-document';
import { FindRelevantCompetencies } from './application/queries/find-relevant-competencies';
import { extractStatements } from './domain/parsing/extract-statements';
import { loggerCurriculumAuditLog } from './infrastructure/audit/logger-curriculum-audit-log';
import { PrismaCompetencyRepository } from './infrastructure/prisma/prisma-competency.repository';
import { noTeacherMaterialSource } from './infrastructure/teacher-material/no-teacher-material-source';

/**
 * The module's composition root. Teacher material (#29) is not wired yet: `noTeacherMaterialSource`
 * answers "no material" until #29 replaces it with an adapter over `MaterialSection`.
 */
const dependencies = {
  competencies: new PrismaCompetencyRepository(),
  teacherMaterial: noTeacherMaterialSource,
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
