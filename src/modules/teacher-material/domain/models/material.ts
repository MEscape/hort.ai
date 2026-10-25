import type { ActorId, TenantId } from '@modules/auth';

import type { ClassroomId, TeacherMaterialId } from './ids';

export interface MaterialScope {
  readonly tenantId: TenantId;
  readonly ownerId: ActorId;
}
export interface Material extends MaterialScope {
  readonly id: TeacherMaterialId;
  readonly classroomId: ClassroomId;
  readonly title: string;
  readonly objectKey: string;
  readonly contentType: 'text/plain';
  readonly sizeBytes: number;
  status: 'UPLOADED' | 'PROCESSED' | 'FAILED' | 'DELETED';
}
export interface MaterialStatement {
  readonly code: string;
  readonly text: string;
  readonly section: string;
  readonly page: number | null;
}
/** 10 MiB bounds storage and extraction work per upload. TXT is UTF-8; PDF needs #29's follow-up extractor. */
export const MATERIAL_MAX_BYTES = 10_485_760;
export const MATERIAL_URL_SECONDS = 60;
export const MATERIAL_LIST_LIMIT = 100;
export const MATERIAL_SNIFF_BYTES = 512;

/**
 * Where the teacher's one upload lands (the only key an upload capability ever names). After
 * validation the server writes the checked bytes to `objectKey` itself and removes this staging
 * object, so read URLs never serve bytes that changed after they were checked.
 */
export function materialUploadKey(objectKey: string): string {
  return `uploads/${objectKey}`;
}
