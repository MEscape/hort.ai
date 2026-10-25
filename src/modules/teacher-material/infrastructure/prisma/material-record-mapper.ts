import { toActorId, toTenantId } from '@modules/auth';

import { toClassroomId, toTeacherMaterialId } from '../../domain/models/ids';

import type { Material } from '../../domain/models/material';

export const MATERIAL_SELECT = [
  'id',
  'tenantId',
  'ownerId',
  'classroomId',
  'title',
  'objectKey',
  'contentType',
  'sizeBytes',
  'status',
] as const;
interface MaterialRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly ownerId: string;
  readonly classroomId: string;
  readonly title: string;
  readonly objectKey: string;
  readonly contentType: 'PDF' | 'TEXT';
  readonly sizeBytes: number;
  readonly status: Material['status'];
}
/** PDF is deliberately not created by this release; metadata maps to the supported extraction type. */
export function toMaterial(row: MaterialRecord): Material {
  return {
    ...row,
    id: toTeacherMaterialId(row.id),
    classroomId: toClassroomId(row.classroomId),
    tenantId: toTenantId(row.tenantId),
    ownerId: toActorId(row.ownerId),
    contentType: 'text/plain',
  };
}
