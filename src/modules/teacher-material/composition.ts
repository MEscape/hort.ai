import 'server-only';
import { randomUUID } from 'node:crypto';

import { getAccessControl } from '@modules/auth';
import { classroomQueries } from '@modules/classroom';

import { createAuditLog } from '@lib/logger';
import { getRateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';
import { storageVisibilityUnavailable } from '@lib/storage';
import { getObjectStore } from '@lib/storage/server';

import { BeginMaterialUpload } from './application/commands/begin-material-upload';
import { CompleteMaterialUpload } from './application/commands/complete-material-upload';
import { DeleteMaterial } from './application/commands/delete-material';
import { GetMaterialReadUrl } from './application/queries/get-material-read-url';
import { ListMaterials } from './application/queries/list-materials';
import { OwnedMaterialClassrooms } from './infrastructure/classroom/owned-material-classrooms';
import { curriculumMaterialIngest } from './infrastructure/curriculum/curriculum-material-ingest';
import { PrismaMaterialRepository } from './infrastructure/prisma/prisma-material.repository';
import { SignedMaterialTextReader } from './infrastructure/storage/signed-material-text-reader';

import type { MaterialDependencies } from './application/material-dependencies';
import type { MaterialAuditLog } from './domain/ports/material-services.port';

const unavailable = () => errAsync(storageVisibilityUnavailable('private'));
const disabledStore: ObjectStore = {
  supports: () => false,
  publicUrl: () => null,
  createUploadTarget: unavailable,
  head: unavailable,
  readStart: unavailable,
  delete: unavailable,
  createReadUrl: unavailable,
};
const audit = createAuditLog<Parameters<MaterialAuditLog['record']>[0]>('teacher-material.audit', {
  'material.upload_started': 'info',
  'material.processed': 'info',
  'material.deleted': 'info',
});
const store = getObjectStore() ?? disabledStore;
const dependencies: MaterialDependencies = {
  authorization: getAccessControl(),
  materials: new PrismaMaterialRepository(),
  classrooms: new OwnedMaterialClassrooms(classroomQueries.getClassroomById),
  store,
  textReader: new SignedMaterialTextReader(store),
  ingest: curriculumMaterialIngest,
  newId: randomUUID,
  rateLimiter: getRateLimiter(),
  audit,
};
/** Server-only upload lifecycle; no storage key or signed URL is persisted outside the request. */
export const materialCommands = {
  beginMaterialUpload: new BeginMaterialUpload(dependencies),
  completeMaterialUpload: new CompleteMaterialUpload(dependencies),
  deleteMaterial: new DeleteMaterial(dependencies),
};
export const materialQueries = {
  listMaterials: new ListMaterials(dependencies),
  getMaterialReadUrl: new GetMaterialReadUrl(dependencies),
};
