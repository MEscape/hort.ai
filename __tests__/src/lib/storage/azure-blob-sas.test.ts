import { describe, expect, it } from 'vitest';

import { blobSasQuery } from '@lib/storage/azure-blob-sas';
import type { BlobSasRequest } from '@lib/storage/azure-blob-sas';

/** Microsoft's published Azurite credentials: public by design. */
const AZURITE_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

const request: BlobSasRequest = {
  accountName: 'devstoreaccount1',
  accountKey: AZURITE_KEY,
  container: 'hortai-private',
  key: 'avatars/u1.png',
  permissions: 'r',
  expiresAt: new Date('2026-10-24T11:00:00.789Z'),
  httpsOnly: false,
};

describe('blobSasQuery', () => {
  // The signatures below were produced by the official @azure/storage-blob SDK
  // (generateBlobSASQueryParameters, version 2022-11-02) for the same inputs.
  it('signs exactly what the Azure SDK signs for a plain HTTP emulator', () => {
    expect(blobSasQuery(request).toString()).toBe(
      'sv=2022-11-02&se=2026-10-24T11%3A00%3A00Z&sr=b&sp=r&sig=PJZOxMZIBkYypZ%2FXBJJewJr09wCX4eTtEuze8uOxw%2F8%3D',
    );
  });

  it('pins the signature to HTTPS for a real storage account', () => {
    expect(blobSasQuery({ ...request, httpsOnly: true }).toString()).toBe(
      'sv=2022-11-02&spr=https&se=2026-10-24T11%3A00%3A00Z&sr=b&sp=r&sig=quxmSjsO8w32ZT0sweN2dgnupjiLQLpzua9kx7oKwjY%3D',
    );
  });

  it('signs the permission, the blob and the expiry, so changing any of them changes the signature', () => {
    const base = blobSasQuery(request).get('sig');
    const changed = [
      { permissions: 'd' as const },
      { key: 'avatars/u2.png' },
      { container: 'hortai-public' },
      { expiresAt: new Date('2026-10-24T11:00:01Z') },
    ].map((override) => blobSasQuery({ ...request, ...override }).get('sig'));

    expect(new Set([base, ...changed]).size).toBe(changed.length + 1);
  });
});
