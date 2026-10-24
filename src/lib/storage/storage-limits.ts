/** Azure caps a blob name at 1024 characters. Keys are ASCII-only (see `validateObjectKey`). */
export const MAX_OBJECT_KEY_LENGTH = 1024;

/** The longest a signed upload or read URL may live. Short on purpose: a signed URL is a bearer credential. */
export const MAX_SIGNED_URL_TTL_SECONDS = 3600;

/** Azure's limit for one `Put Blob` (5000 MiB). Larger objects need staged blocks, which this contract does not offer. */
export const MAX_UPLOAD_BYTES = 5_242_880_000;

/** What `readStart` may return: enough for signature sniffing and image headers, never a whole file. */
export const MAX_READ_START_BYTES = 65_536;

export const MAX_CONTENT_TYPE_LENGTH = 127;
export const MAX_CACHE_CONTROL_LENGTH = 128;
