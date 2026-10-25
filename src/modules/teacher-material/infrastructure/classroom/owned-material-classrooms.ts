import type { classroomQueries } from '@modules/classroom';

import { toClassroomId } from '../../domain/models/ids';

import type { MaterialClassrooms } from '../../domain/ports/material-services.port';

/** Uses #32's public ownership check, not a second implementation of classroom authorization. */
export class OwnedMaterialClassrooms implements MaterialClassrooms {
  constructor(private readonly query: typeof classroomQueries.getClassroomById) {}
  requireOwned: MaterialClassrooms['requireOwned'] = (id) =>
    this.query.execute(id).map((room) => ({ id: toClassroomId(room.id), status: room.status }));
}
