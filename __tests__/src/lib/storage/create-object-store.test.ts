import { describe, expect, it } from 'vitest';

import type { Clock } from '@lib/clock';
import type { StorageEnv } from '@lib/config/storage-env-schema';
import { AzureBlobObjectStore } from '@lib/storage/azure-blob-object-store';
import { createObjectStore } from '@lib/storage/create-object-store';

/** Microsoft's published Azurite credentials: public by design. */
const AZURITE_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

const clock: Clock = { now: () => new Date('2026-10-24T10:00:00Z') };

const none: StorageEnv = { STORAGE_PROVIDER: 'none' };
const azure: StorageEnv = {
  STORAGE_PROVIDER: 'azure',
  STORAGE_AZURE_ACCOUNT_NAME: 'devstoreaccount1',
  STORAGE_AZURE_ACCOUNT_KEY: AZURITE_KEY,
};

describe('createObjectStore', () => {
  it('builds no store while storage is off', () => {
    expect(createObjectStore(none, { clock })).toBeNull();
  });

  it('builds an Azure store that supports only the containers that are configured', () => {
    const store = createObjectStore(
      { ...azure, STORAGE_AZURE_PRIVATE_CONTAINER: 'hortai-private' },
      { clock },
    );

    expect(store).toBeInstanceOf(AzureBlobObjectStore);
    expect(store?.supports('private')).toBe(true);
    expect(store?.supports('public')).toBe(false);
  });

  it('builds a public-only Azure store', () => {
    const store = createObjectStore(
      {
        ...azure,
        STORAGE_AZURE_PUBLIC_CONTAINER: 'hortai-public',
        STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.org/hortai-public',
      },
      { clock },
    );

    expect(store?.supports('public')).toBe(true);
    expect(store?.supports('private')).toBe(false);
  });

  it('passes the endpoint, containers and public origin on', () => {
    const store = createObjectStore(
      {
        ...azure,
        STORAGE_AZURE_BLOB_ENDPOINT: 'http://127.0.0.1:10000/devstoreaccount1',
        STORAGE_AZURE_PUBLIC_CONTAINER: 'hortai-public',
        STORAGE_AZURE_PRIVATE_CONTAINER: 'hortai-private',
        STORAGE_PUBLIC_BASE_URL: 'http://127.0.0.1:10000/devstoreaccount1/hortai-public',
      },
      { clock },
    );

    expect(store?.supports('public')).toBe(true);
    expect(store?.publicUrl('a.png')).toBe(
      'http://127.0.0.1:10000/devstoreaccount1/hortai-public/a.png',
    );
  });

  it('refuses an Azure configuration without credentials, which the schema already rules out', () => {
    expect(() =>
      createObjectStore(
        { STORAGE_PROVIDER: 'azure', STORAGE_AZURE_ACCOUNT_NAME: 'acct' },
        { clock },
      ),
    ).toThrow('needs the account name and key');
    expect(() =>
      createObjectStore(
        { STORAGE_PROVIDER: 'azure', STORAGE_AZURE_ACCOUNT_KEY: AZURITE_KEY },
        { clock },
      ),
    ).toThrow('needs the account name and key');
  });

  it('refuses a provider it does not know', () => {
    expect(() =>
      createObjectStore({ STORAGE_PROVIDER: 's3' } as unknown as StorageEnv, { clock }),
    ).toThrow('Unsupported STORAGE_PROVIDER');
  });
});
