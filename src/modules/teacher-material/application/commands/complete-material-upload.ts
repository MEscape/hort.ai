import { conflictError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedMaterial } from '../load-authorized-material';
import { MATERIAL_RATE_LIMITS } from '../rate-limits';
import { extractMaterial } from '../services/extract-material';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { MaterialDependencies } from '../material-dependencies';

/** Checks stored size, MIME and bytes; publishes only curriculum-pipeline statements, never raw text. */
export class CompleteMaterialUpload {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(id: string): AppResultAsync<void, MaterialError> {
    const { materials, store, rateLimiter, audit } = this.deps;
    return loadAuthorizedMaterial(this.deps, id, 'material.create').andThen((row) => {
      if (row.status === 'PROCESSED') {
        return okAsync(undefined);
      }
      if (row.status !== 'UPLOADED') {
        return errAsync(conflictError('teacher_material.not_pending', 'Material is not pending.'));
      }
      return rateLimiter
        .enforce({
          policy: MATERIAL_RATE_LIMITS.complete,
          subject: { kind: 'actor', actorId: row.ownerId, tenantId: row.tenantId },
        })
        .andThen(() =>
          this.deps.classrooms.requireOwned(row.classroomId).andThen((room) => {
            if (room.status !== 'active') {
              return errAsync(
                conflictError('teacher_material.class_archived', 'Class is archived.'),
              );
            }
            return extractMaterial(this.deps, row)
              .orElse((error) =>
                materials
                  .retire(row, 'FAILED')
                  .andThen((changed) =>
                    changed
                      ? store.delete({ visibility: 'private', key: row.objectKey })
                      : okAsync(undefined),
                  )
                  .andThen(() => errAsync(error)),
              )
              .andThen((statements) => materials.process(row, statements))
              .andThen((published) => {
                if (!published) {
                  return errAsync(
                    conflictError('teacher_material.not_pending', 'Material is not pending.'),
                  );
                }
                audit.record({ type: 'material.processed', materialId: row.id });
                return okAsync(undefined);
              });
          }),
        );
    });
  }
}
