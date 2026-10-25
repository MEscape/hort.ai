import type { AppResultAsync } from '@lib/result';
import type { ObjectLocation } from '@lib/storage';

import type { ClassroomId } from '../models/ids';
import type { ConvertibleMaterialMime, MaterialStatement } from '../models/material';

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
  /**
   * The server's own write of already validated bytes to a key no client capability names.
   * Create-only: fails with `MATERIAL_ALREADY_WRITTEN` instead of replacing an existing copy.
   */
  write(location: ObjectLocation, bytes: Uint8Array, contentType: string): AppResultAsync<void>;
}
export interface MaterialIngest {
  extract(text: string): readonly MaterialStatement[];
}
export interface MaterialDocumentConverter {
  /** The plain text of a Word or PowerPoint file, or `null` when the bytes are not a readable one. */
  toText(contentType: ConvertibleMaterialMime, bytes: Uint8Array): string | null;
}
