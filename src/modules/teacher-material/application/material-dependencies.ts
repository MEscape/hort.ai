import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';
import type { ObjectStore } from '@lib/storage';

import type { MaterialRepository } from '../domain/ports/material.repository';
import type { MaterialAuditLog, MaterialClassrooms, MaterialIngest, MaterialTextReader } from '../domain/ports/material-services.port';

export interface MaterialDependencies {
  readonly authorization: AuthorizationService;
  readonly materials: MaterialRepository;
  readonly classrooms: MaterialClassrooms;
  readonly store: ObjectStore;
  readonly textReader: MaterialTextReader;
  readonly ingest: MaterialIngest;
  readonly newId: () => string;
  readonly rateLimiter: RateLimiter;
  readonly audit: MaterialAuditLog;
}
