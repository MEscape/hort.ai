import { conflictError } from '@lib/errors';
import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';
import type { UploadTarget } from '@lib/storage';

import { parseClassroomId, toTeacherMaterialId } from '../../domain/models/ids';
import { MATERIAL_URL_SECONDS } from '../../domain/models/material';
import { MATERIAL_RATE_LIMITS } from '../rate-limits';
import { validateMaterialInput } from '../services/material-validation';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { BeginMaterialInput } from '../contracts/material-inputs';
import type { MaterialDependencies } from '../material-dependencies';

/** Creates the DB source of truth before issuing any upload capability. */
export class BeginMaterialUpload {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(
    input: BeginMaterialInput,
  ): AppResultAsync<{ readonly materialId: string; readonly upload: UploadTarget }, MaterialError> {
    const { authorization, materials, classrooms, rateLimiter, store, audit } = this.deps;
    return authorization.requireInTenant('material.create').andThen((actor) =>
      parseClassroomId(input.classroomId)
        .asyncAndThen((id) => classrooms.requireOwned(id))
        .andThen((room) => {
          if (room.status !== 'active') {
            return errAsync(conflictError('teacher_material.class_archived', 'Class is archived.'));
          }
          return validateMaterialInput(input).asyncAndThen((valid) =>
            rateLimiter
              .enforce({
                policy: MATERIAL_RATE_LIMITS.upload,
                subject: { kind: 'actor', actorId: actor.id, tenantId: actor.tenantId },
              })
              .andThen(() => {
                const id = toTeacherMaterialId(this.deps.newId());
                return materials
                  .create({
                    id,
                    tenantId: actor.tenantId,
                    ownerId: actor.id,
                    classroomId: room.id,
                    title: valid.title.trim(),
                    contentType: 'text/plain',
                    sizeBytes: valid.sizeBytes,
                    objectKey: `classes/${room.id}/materials/${id}`,
                    status: 'UPLOADED',
                  })
                  .andThen((row) =>
                    store
                      .createUploadTarget({
                        location: { visibility: 'private', key: row.objectKey },
                        contentType: row.contentType,
                        byteSize: row.sizeBytes,
                        cacheControl: 'no-store',
                        expiresInSeconds: MATERIAL_URL_SECONDS,
                      })
                      .map((upload) => {
                        audit.record({ type: 'material.upload_started', materialId: id });
                        return { materialId: id, upload };
                      })
                      .orElse((error) =>
                        materials.retire(row, 'FAILED').andThen(() => errAsync(error)),
                      ),
                  );
              }),
          );
        }),
    );
  }
}
