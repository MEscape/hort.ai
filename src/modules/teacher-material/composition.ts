import 'server-only';
import { randomUUID } from 'node:crypto';

import { getAccessControl } from '@modules/auth';
import { classroomQueries } from '@modules/classroom';

import { getRateLimiter } from '@lib/rate-limit';
import { errAsync } from '@lib/result';
import type { ObjectStore } from '@lib/storage';
import { storageVisibilityUnavailable } from '@lib/storage';
import { getObjectStore } from '@lib/storage/server';

import { BeginMaterialUpload } from './application/commands/begin-material-upload';
import { CompleteMaterialUpload } from './application/commands/complete-material-upload';
import { DeleteMaterial } from './application/commands/delete-material';
import { UploadMaterial } from './application/commands/upload-material';
import { GetMaterialReadUrl } from './application/queries/get-material-read-url';
import { ListMaterials } from './application/queries/list-materials';
import { loggerMaterialAuditLog } from './infrastructure/audit/logger-material-audit-log';
import { OwnedMaterialClassrooms } from './infrastructure/classroom/owned-material-classrooms';
import { curriculumMaterialIngest } from './infrastructure/curriculum/curriculum-material-ingest';
import { officeMaterialConverter } from './infrastructure/office/office-material-converter';
import { PrismaMaterialRepository } from './infrastructure/prisma/prisma-material.repository';
import { SignedMaterialObjectWriter } from './infrastructure/storage/signed-material-object-writer';
import { SignedMaterialTextReader } from './infrastructure/storage/signed-material-text-reader';

import type { MaterialDependencies } from './application/material-dependencies';

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

const store = getObjectStore() ?? disabledStore;
const dependencies: MaterialDependencies = {
  authorization: getAccessControl(),
  materials: new PrismaMaterialRepository(),
  classrooms: new OwnedMaterialClassrooms(classroomQueries.getClassroomById),
  store,
  textReader: new SignedMaterialTextReader(store),
  writer: new SignedMaterialObjectWriter(store),
  ingest: curriculumMaterialIngest,
  converter: officeMaterialConverter,
  newId: randomUUID,
  rateLimiter: getRateLimiter(),
  audit: loggerMaterialAuditLog,
};
/** Server-only upload lifecycle; no storage key or signed URL is persisted outside the request. */
export const materialCommands = {
  beginMaterialUpload: new BeginMaterialUpload(dependencies),
  completeMaterialUpload: new CompleteMaterialUpload(dependencies),
  deleteMaterial: new DeleteMaterial(dependencies),
  uploadMaterial: new UploadMaterial(dependencies),
};
export const materialQueries = {
  listMaterials: new ListMaterials(dependencies),
  getMaterialReadUrl: new GetMaterialReadUrl(dependencies),
};
