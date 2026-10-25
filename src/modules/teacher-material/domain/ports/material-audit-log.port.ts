import type { TeacherMaterialId } from '../models/ids';

/** Audit carries identifiers only, never titles, file content or signed URLs. */
export type MaterialEvent =
  | { readonly type: 'material.upload_started'; readonly materialId: TeacherMaterialId }
  | { readonly type: 'material.processed'; readonly materialId: TeacherMaterialId }
  | { readonly type: 'material.deleted'; readonly materialId: TeacherMaterialId };

export interface MaterialAuditLog {
  record(event: MaterialEvent): void;
}
