import type { CompetencyRepository } from '../domain/ports/competency.repository';
import type { CurriculumAuditLog } from '../domain/ports/curriculum-audit-log.port';
import type { TeacherMaterialSource } from '../domain/ports/teacher-material.port';

/** What the curriculum use cases are built from. */
export interface CurriculumDependencies {
  readonly competencies: CompetencyRepository;
  readonly teacherMaterial: TeacherMaterialSource;
  readonly audit: CurriculumAuditLog;
}
