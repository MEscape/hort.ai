import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';
import type { ObjectLocation } from '@lib/storage';

import type { MaterialStatement } from '../models/material';

export interface MaterialClassrooms {
  requireOwned(id: string): AppResultAsync<{ readonly id: string; readonly status: string }, AppError>;
}
export interface MaterialTextReader {
  /** Fetch private bytes with a streaming size cap; never log the signed URL. */
  read(location: ObjectLocation, maxBytes: number): AppResultAsync<Uint8Array, AppError>;
}
export interface MaterialIngest {
  extract(text: string): readonly MaterialStatement[];
}
export interface MaterialAuditLog {
  record(event: { readonly type: string; readonly materialId: string }): void;
}
