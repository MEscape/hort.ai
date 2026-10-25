import type { ValidationAppError } from '@lib/errors';
import { err, errAsync, ok } from '@lib/result';
import type { AppResult, AppResultAsync } from '@lib/result';

import { materialUploadKey } from '../../domain/models/material';
import { loadAuthorizedMaterial } from '../load-authorized-material';
import { invalidMaterial, isConvertibleContentType } from '../services/material-validation';

import { BeginMaterialUpload } from './begin-material-upload';
import { CompleteMaterialUpload } from './complete-material-upload';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { BeginMaterialInput } from '../contracts/material-inputs';
import type { MaterialDependencies } from '../material-dependencies';

/**
 * The class page's upload: the file reaches the server, which runs the same begin/complete
 * lifecycle and writes the staging object itself. The storage account allows no browser PUT
 * (CORS), and no signed URL ever reaches the client this way. A Word or PowerPoint file (#126)
 * is turned into its text first; the text then goes through the unchanged text-material checks.
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
    return this.deps.authorization
      .requireInTenant('material.create')
      .andThen(() => this.asText(input, bytes).asyncAndThen((text) => this.store(text)));
  }

  private asText(
    input: BeginMaterialInput,
    bytes: Uint8Array,
  ): AppResult<
    { readonly input: BeginMaterialInput; readonly bytes: Uint8Array },
    ValidationAppError
  > {
    if (!isConvertibleContentType(input.contentType)) {
      return ok({ input, bytes });
    }
    const text = this.deps.converter.toText(input.contentType, bytes);
    return text === null
      ? err(invalidMaterial())
      : ok({
          input: { ...input, contentType: 'text/plain' },
          bytes: new TextEncoder().encode(text),
        });
  }

  private store({
    input,
    bytes,
  }: {
    readonly input: BeginMaterialInput;
    readonly bytes: Uint8Array;
  }): AppResultAsync<{ readonly materialId: string }, MaterialError> {
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
