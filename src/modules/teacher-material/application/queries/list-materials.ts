import type { AppResultAsync } from '@lib/result';

import { parseClassroomId } from '../../domain/models/ids';
import { MATERIAL_QUERY_LIMITS } from '../material-limits';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { MaterialView } from '../contracts/material-views';
import type { MaterialDependencies } from '../material-dependencies';

/** @rate-limit none Authenticated teacher-only read, bounded to the newest 100 rows by the repository. */
export class ListMaterials {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(classroomId: string): AppResultAsync<readonly MaterialView[], MaterialError> {
    return this.deps.authorization.requireInTenant('material.read').andThen((actor) =>
      parseClassroomId(classroomId)
        .asyncAndThen((id) => this.deps.classrooms.requireOwned(id))
        .andThen((room) =>
          this.deps.materials
            .list(room.id, { tenantId: actor.tenantId, ownerId: actor.id })
            .map((rows) =>
              rows.slice(0, MATERIAL_QUERY_LIMITS.list).map((row) => ({
                id: row.id,
                classroomId: row.classroomId,
                title: row.title,
                contentType: row.contentType,
                sizeBytes: row.sizeBytes,
                status: row.status,
                createdAt: row.createdAt?.toISOString() ?? null,
              })),
            ),
        ),
    );
  }
}
