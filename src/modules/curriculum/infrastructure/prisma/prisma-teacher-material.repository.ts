import type { ActorId, TenantId } from '@modules/auth';

import { createPersistenceFailures, db } from '@lib/db';
import type { InfrastructureAppError } from '@lib/errors';
import { fromThrowableAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import {
  TEACHER_MATERIAL_METADATA_SELECT,
  TEACHER_MATERIAL_SECTION_SELECT,
  toTeacherMaterialStatements,
} from './teacher-material-record-mapper';

import type { TeacherMaterialStatement } from '../../domain/models/competency';
import type { ClassroomId, ChildProfileId } from '../../domain/models/ids';
import type { TeacherMaterialRepository } from '../../domain/ports/teacher-material.repository';

const failures = createPersistenceFailures({
  module: 'curriculum.material',
  code: 'curriculum.material_read_failed',
  subject: 'Material',
});

/**
 * Narrow read projection over #29's MaterialSection, as agreed by the TeacherMaterialSource port.
 * One SQL snapshot starts at the authorized ChildProfile (owner + tenant), through its current
 * membership. This prevents a stale membership check from reading another class's material.
 */
export class PrismaTeacherMaterialRepository implements TeacherMaterialRepository {
  list(input: {
    readonly classroomId: ClassroomId;
    readonly childProfileId: ChildProfileId;
    readonly tenantId: TenantId;
    readonly ownerId: ActorId;
    readonly limit: number;
  }): AppResultAsync<readonly TeacherMaterialStatement[], InfrastructureAppError> {
    const { classroomId, childProfileId, tenantId, ownerId, limit } = input;
    return fromThrowableAsync(async () => {
      const child = await db.orm.public.ChildProfile.where({
        id: childProfileId,
        tenantId,
        ownerId,
      })
        .select('id')
        .include('membership', (membership) =>
          membership
            .where({ classroomId, tenantId })
            .select('classroomId')
            .include('classroom', (classroom) =>
              classroom
                .where({ status: 'ACTIVE', tenantId })
                .select('id')
                .include('materials', (material) =>
                  material
                    .where({ classroomId, tenantId, status: 'PROCESSED' })
                    .select(...TEACHER_MATERIAL_METADATA_SELECT)
                    .orderBy((row) => row.createdAt.desc())
                    .limit(limit)
                    .include('sections', (sections) =>
                      sections
                        .select(...TEACHER_MATERIAL_SECTION_SELECT)
                        .orderBy((row) => row.position.asc())
                        .limit(limit),
                    ),
                ),
            ),
        )
        .first();
      return (child?.membership?.classroom?.materials ?? [])
        .flatMap(toTeacherMaterialStatements)
        .slice(0, limit);
    }, failures.infraOnly('list'));
  }
}
