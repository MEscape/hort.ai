import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { MATERIAL_MAX_BYTES, MATERIAL_SNIFF_BYTES } from '../../domain/models/material';
import { MATERIAL_QUERY_LIMITS } from '../material-limits';

import { decodeMaterial, invalidMaterial } from './material-validation';

import type { Material, MaterialStatement } from '../../domain/models/material';
import type { MaterialDependencies } from '../material-dependencies';

/** HEAD is not authority for the subsequent read: validate the complete fetched bytes too. */
export function extractMaterial(
  deps: MaterialDependencies,
  row: Material,
): AppResultAsync<readonly MaterialStatement[]> {
  const location = { visibility: 'private' as const, key: row.objectKey };
  return deps.store.head(location).andThen((head) => {
    if (
      head?.byteSize !== row.sizeBytes ||
      head.byteSize > MATERIAL_MAX_BYTES ||
      head.contentType !== row.contentType
    ) {
      return errAsync(invalidMaterial());
    }
    return deps.store
      .readStart(location, Math.min(MATERIAL_SNIFF_BYTES, row.sizeBytes))
      .andThen((prefix) =>
        decodeMaterial(prefix, { prefix: true })
          .asyncAndThen(() => deps.textReader.read(location, row.sizeBytes))
          .andThen((bytes) => {
            if (bytes.length !== row.sizeBytes) {
              return errAsync(invalidMaterial());
            }
            return decodeMaterial(bytes).asyncAndThen((text) => {
              const statements = deps.ingest.extract(text);
              return statements.length === 0 || statements.length > MATERIAL_QUERY_LIMITS.statements
                ? errAsync(invalidMaterial())
                : okAsync(statements);
            });
          }),
      );
  });
}
