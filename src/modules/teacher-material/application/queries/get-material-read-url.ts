import { errAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { teacherMaterialNotFound } from '../../domain/errors/teacher-material-errors';
import { MATERIAL_URL_SECONDS } from '../../domain/models/material';
import { loadAuthorizedMaterial } from '../load-authorized-material';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { MaterialDependencies } from '../material-dependencies';

/** @rate-limit none Authenticated owner-only read of one row; capability lasts 60 seconds. */
export class GetMaterialReadUrl {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(id: string): AppResultAsync<string, MaterialError> {
    return loadAuthorizedMaterial(this.deps, id, 'material.read').andThen((row) =>
      row.status === 'PROCESSED'
        ? this.deps.store.createReadUrl({
            key: row.objectKey,
            expiresInSeconds: MATERIAL_URL_SECONDS,
          })
        : errAsync(teacherMaterialNotFound()),
    );
  }
}
