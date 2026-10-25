import type { Permission } from '@modules/auth';

import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { teacherMaterialNotFound } from '../domain/errors/teacher-material-errors';
import { parseTeacherMaterialId } from '../domain/models/ids';

import { scopeOf } from './material-scope';

import type { MaterialDependencies } from './material-dependencies';
import type { MaterialError } from '../domain/errors/material-errors';
import type { Material } from '../domain/models/material';

/** Always resolve by stored owner and tenant, then authorize on the resource itself. */
export function loadAuthorizedMaterial(
  deps: MaterialDependencies,
  rawId: string,
  permission: Permission,
): AppResultAsync<Material, MaterialError> {
  return deps.authorization.requireInTenant(permission).andThen((actor) =>
    parseTeacherMaterialId(rawId)
      .asyncAndThen((id) => deps.materials.find(id, actor.id, actor.tenantId))
      .andThen((row) => {
        if (!row) {
          return errAsync(teacherMaterialNotFound());
        }
        return deps.authorization
          .requireOnResource(permission, scopeOf(row))
          .andThen(() => okAsync(row));
      }),
  );
}
