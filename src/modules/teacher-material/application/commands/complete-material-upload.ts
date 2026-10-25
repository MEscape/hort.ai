import { conflictError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MATERIAL_ALREADY_WRITTEN, materialUploadKey } from '../../domain/models/material';
import { loadAuthorizedMaterial } from '../load-authorized-material';
import { MATERIAL_RATE_LIMITS } from '../rate-limits';
import { extractMaterial } from '../services/extract-material';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { MaterialDependencies } from '../material-dependencies';

/**
 * Checks stored size, MIME and bytes of the upload; publishes only curriculum-pipeline
 * statements, never raw text. The checked bytes are written by the server to the material's own
 * key, which no upload capability names, and the upload is removed: the upload URL stays valid
 * for its whole lifetime, so the uploaded object could still be replaced after the check.
 * The write is create-only: when a parallel (or crashed) completion already published a copy,
 * the statements are re-taken from that copy, so whichever completion wins the status CAS stores
 * statements that match the served bytes, and no completion ever overwrites them.
 */
export class CompleteMaterialUpload {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(id: string): AppResultAsync<void, MaterialError> {
    const { materials, store, writer, rateLimiter, audit } = this.deps;
    return loadAuthorizedMaterial(this.deps, id, 'material.create').andThen((row) => {
      const upload = { visibility: 'private' as const, key: materialUploadKey(row.objectKey) };
      const published = { visibility: 'private' as const, key: row.objectKey };
      if (row.status === 'PROCESSED') {
        // Idempotent; also finishes a cleanup an earlier completion could not.
        return store.delete(upload);
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
            return extractMaterial(this.deps, row, upload)
              .andThen(({ bytes, statements }) =>
                writer
                  .write(published, bytes, row.contentType)
                  .map(() => statements)
                  .orElse((error) =>
                    error.code === MATERIAL_ALREADY_WRITTEN
                      ? extractMaterial(this.deps, row, published).map((copy) => copy.statements)
                      : errAsync(error),
                  ),
              )
              .orElse((error) =>
                materials
                  .retire(row, 'FAILED')
                  .andThen((changed) =>
                    changed
                      ? store.delete(upload).andThen(() => store.delete(published))
                      : okAsync(undefined),
                  )
                  .andThen(() => errAsync(error)),
              )
              .andThen((statements) => materials.process(row, statements))
              .andThen((processed) => {
                if (!processed) {
                  return errAsync(
                    conflictError('teacher_material.not_pending', 'Material is not pending.'),
                  );
                }
                audit.record({ type: 'material.processed', materialId: row.id });
                return store.delete(upload);
              });
          }),
        );
    });
  }
}
