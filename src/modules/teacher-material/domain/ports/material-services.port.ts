import type { AppResultAsync } from '@lib/result';
import type { ObjectLocation } from '@lib/storage';

import type { ClassroomId, TeacherMaterialId } from '../models/ids';
import type { MaterialStatement } from '../models/material';

export interface MaterialClassrooms {
  requireOwned(
    id: ClassroomId,
  ): AppResultAsync<{ readonly id: ClassroomId; readonly status: string }>;
}
export interface MaterialTextReader {
  /** Fetch private bytes with a streaming size cap; never log the signed URL. */
  read(location: ObjectLocation, maxBytes: number): AppResultAsync<Uint8Array>;
}
export interface MaterialIngest {
  extract(text: string): readonly MaterialStatement[];
}
export interface MaterialAuditLog {
  record(event: { readonly type: string; readonly materialId: TeacherMaterialId }): void;
}
