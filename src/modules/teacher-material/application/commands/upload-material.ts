import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { materialUploadKey } from '../../domain/models/material';
import { loadAuthorizedMaterial } from '../load-authorized-material';

import { BeginMaterialUpload } from './begin-material-upload';
import { CompleteMaterialUpload } from './complete-material-upload';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { BeginMaterialInput } from '../contracts/material-inputs';
import type { MaterialDependencies } from '../material-dependencies';

/**
 * The class page's upload: the file reaches the server, which runs the same begin/complete
 * lifecycle and writes the staging object itself. The storage account allows no browser PUT
 * (CORS), and no signed URL ever reaches the client this way.
 * @audit-exempt The delegated BeginMaterialUpload and CompleteMaterialUpload emit both lifecycle events.
 */
export class UploadMaterial {
  private readonly begin: BeginMaterialUpload;
  private readonly complete: CompleteMaterialUpload;
  constructor(private readonly deps: MaterialDependencies) {
    this.begin = new BeginMaterialUpload(deps);
    this.complete = new CompleteMaterialUpload(deps);
  }
  execute(
    input: BeginMaterialInput,
    bytes: Uint8Array,
  ): AppResultAsync<{ readonly materialId: string }, MaterialError> {
    return this.begin.execute({ ...input, sizeBytes: bytes.byteLength }).andThen(({ materialId }) =>
      loadAuthorizedMaterial(this.deps, materialId, 'material.create').andThen((row) =>
        this.deps.writer
          .write(
            { visibility: 'private', key: materialUploadKey(row.objectKey) },
            bytes,
            row.contentType,
          )
          .orElse((error) =>
            this.deps.materials.retire(row, 'FAILED').andThen(() => errAsync(error)),
          )
          .andThen(() => this.complete.execute(materialId))
          .map(() => ({ materialId })),
      ),
    );
  }
}
