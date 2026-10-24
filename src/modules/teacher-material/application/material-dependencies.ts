import type { AuthorizationService } from '@modules/auth';

import type { RateLimiter } from '@lib/rate-limit';
import type { ObjectStore } from '@lib/storage';

import type { MaterialAuditLog } from '../domain/ports/material-audit-log.port';
import type {
  MaterialClassrooms,
  MaterialIngest,
  MaterialTextReader,
} from '../domain/ports/material-services.port';
import type { MaterialRepository } from '../domain/ports/material.repository';

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
