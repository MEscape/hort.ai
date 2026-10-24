import type { AppResultAsync } from '@lib/result';

import { loadAuthorizedMaterial } from '../load-authorized-material';
import { MATERIAL_RATE_LIMITS } from '../rate-limits';

import type { MaterialError } from '../../domain/errors/material-errors';
import type { MaterialDependencies } from '../material-dependencies';

/** Tombstones and removes sections atomically before object deletion. Retry cleans up a failed storage delete. */
export class DeleteMaterial {
  constructor(private readonly deps: MaterialDependencies) {}
  execute(id: string): AppResultAsync<void, MaterialError> {
    const { materials, rateLimiter, store, audit } = this.deps;
    return loadAuthorizedMaterial(this.deps, id, 'material.delete').andThen((row) =>
      rateLimiter
        .enforce({
          policy: MATERIAL_RATE_LIMITS.delete,
          subject: { kind: 'actor', actorId: row.ownerId, tenantId: row.tenantId },
        })
        .andThen(() =>
          materials
            .retire(row, 'DELETED')
            .andThen(() => store.delete({ visibility: 'private', key: row.objectKey }))
            .map(() => {
              audit.record({ type: 'material.deleted', materialId: row.id });
            }),
        ),
    );
  }
}
