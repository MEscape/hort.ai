import { createHmac } from 'node:crypto';

import { buildQueryString } from '@lib/utils';

/** Service SAS version this signs. Its string-to-sign has the 16 fields built below. */
const SAS_VERSION = '2022-11-02';

/** Read (`r`), create and write (`cw`) or delete (`d`): one operation per signature, never more. */
export type BlobSasPermissions = 'r' | 'cw' | 'd';

export interface BlobSasRequest {
  readonly accountName: string;
  /** The storage account key, base64 as the Azure portal shows it. */
  readonly accountKey: string;
  readonly container: string;
  /** Already validated: only `[A-Za-z0-9._-]` segments, so nothing in it needs URL encoding. */
  readonly key: string;
  readonly permissions: BlobSasPermissions;
  readonly expiresAt: Date;
  /** `true` for a real storage account; `false` only for the local emulator, which speaks plain HTTP. */
  readonly httpsOnly: boolean;
}

/** `2026-10-24T10:00:00Z`: the whole-second UTC form Azure signs and parses. */
function sasTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * The query string of a service SAS for one blob, signed with the account key (HMAC-SHA256 over
 * the string-to-sign). The signature covers the blob, the single operation and the expiry, so
 * the URL it is appended to is a bearer capability for exactly that until `expiresAt`.
 *
 * shortcut: account-key signing, because it needs no identity service and no SDK; a user
 * delegation SAS (Entra ID) avoids the long-lived key - switch when the key may not be stored.
 */
export function blobSasQuery(request: BlobSasRequest): URLSearchParams {
  const protocol = request.httpsOnly ? 'https' : '';
  const expiry = sasTime(request.expiresAt);
  const stringToSign = [
    request.permissions,
    '', // start: valid immediately
    expiry,
    `/blob/${request.accountName}/${request.container}/${request.key}`,
    '', // stored access policy
    '', // IP range
    protocol,
    SAS_VERSION,
    'b', // resource: a blob
    '', // snapshot time
    '', // encryption scope
    '', // response header overrides: cache-control, content-disposition, -encoding, -language, -type
    '',
    '',
    '',
    '',
  ].join('\n');

  const signature = createHmac('sha256', Buffer.from(request.accountKey, 'base64'))
    .update(stringToSign, 'utf8')
    .digest('base64');

  return new URLSearchParams(
    buildQueryString({
      sv: SAS_VERSION,
      spr: request.httpsOnly ? protocol : undefined,
      se: expiry,
      sr: 'b',
      sp: request.permissions,
      sig: signature,
    }),
  );
}
