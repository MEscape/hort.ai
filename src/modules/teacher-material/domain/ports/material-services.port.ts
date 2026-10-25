import type { AppResultAsync } from '@lib/result';
import type { ObjectLocation } from '@lib/storage';

import type { ClassroomId } from '../models/ids';
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
export interface MaterialObjectWriter {
  /** The server's own write of already validated bytes to a key no client capability names. */
  write(location: ObjectLocation, bytes: Uint8Array, contentType: string): AppResultAsync<void>;
}
export interface MaterialIngest {
  extract(text: string): readonly MaterialStatement[];
}
