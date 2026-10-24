import { createPersistenceFailures, db } from '@lib/db';
import { fromThrowableAsync } from '@lib/result';

import { MATERIAL_LIST_LIMIT } from '../../domain/models/material';

import { MATERIAL_SELECT, toMaterial } from './material-record-mapper';

import type { MaterialRepository } from '../../domain/ports/material.repository';

const failures = createPersistenceFailures({
  module: 'teacher-material.persistence',
  code: 'teacher_material.persistence_failed',
  subject: 'Material',
});

/** Every material read/write is pinned to its stored owner and tenant. Child rows are reached only through that scope. */
export class PrismaMaterialRepository implements MaterialRepository {
  create: MaterialRepository['create'] = (row) =>
    fromThrowableAsync(
      async () =>
        db.orm.public.TeacherMaterial.select(...MATERIAL_SELECT).create({
          ...row,
          contentType: 'TEXT',
        }),
      failures.infraOnly('create'),
    ).map(toMaterial);

  find: MaterialRepository['find'] = (id, ownerId, tenantId) =>
    fromThrowableAsync(
      async () =>
        db.orm.public.TeacherMaterial.select(...MATERIAL_SELECT)
          .where({ id, ownerId, tenantId })
          .first(),
      failures.infraOnly('find'),
    ).map((row) => (row ? toMaterial(row) : null));

  list: MaterialRepository['list'] = (classroomId, scope) =>
    fromThrowableAsync(
      async () =>
        db.orm.public.TeacherMaterial.select(...MATERIAL_SELECT)
          .where({ classroomId, ...scope })
          .where((row) => row.status.neq('DELETED'))
          .orderBy([(row) => row.createdAt.desc(), (row) => row.id.asc()])
          .limit(MATERIAL_LIST_LIMIT)
          .all(),
      failures.infraOnly('list'),
    ).map((rows) => rows.map(toMaterial));

  process: MaterialRepository['process'] = (row, sections) =>
    fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const changed = await tx.orm.public.TeacherMaterial.where({
            id: row.id,
            tenantId: row.tenantId,
            ownerId: row.ownerId,
            status: 'UPLOADED',
          }).updateAndCount({ status: 'PROCESSED' });
          if (changed === 0) {
            return false;
          }
          await tx.orm.public.MaterialSection.createAll(
            sections.map((section, position) => ({
              materialId: row.id,
              position,
              code: section.code,
              text: section.text,
              section: section.section,
              page: section.page,
            })),
          );
          return true;
        }),
      failures.infraOnly('process'),
    );

  retire: MaterialRepository['retire'] = (row, status) =>
    fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          const scoped = tx.orm.public.TeacherMaterial.where({
            id: row.id,
            tenantId: row.tenantId,
            ownerId: row.ownerId,
          });
          const changed = await (
            status === 'FAILED' ? scoped.where({ status: 'UPLOADED' }) : scoped
          ).updateAndCount({ status });
          if (changed > 0) {
            // @owner-scope parent The owning material was locked/updated with owner and tenant in this transaction.
            await tx.orm.public.MaterialSection.where({ materialId: row.id }).deleteAndCount();
          }
        }),
      failures.infraOnly('retire'),
    );
}
