import type { Clock } from '@lib/clock';
import type { StorageEnv } from '@lib/config/storage-env-schema';
import { assertNever, invariant } from '@lib/utils';

import { AzureBlobObjectStore } from './azure-blob-object-store';

import type { ObjectStore } from './object-store';

/**
 * Builds the store the storage settings name, or `null` for `none`. The schema already
 * guarantees what a provider needs. There is no fallback to another provider: a configured
 * store that fails reports the failure.
 */
export function createObjectStore(env: StorageEnv, deps: { clock: Clock }): ObjectStore | null {
  switch (env.STORAGE_PROVIDER) {
    case 'none':
      return null;
    case 'azure': {
      const { STORAGE_AZURE_ACCOUNT_NAME: accountName, STORAGE_AZURE_ACCOUNT_KEY: accountKey } =
        env;
      invariant(
        accountName && accountKey,
        'STORAGE_PROVIDER=azure needs the account name and key.',
      );
      return new AzureBlobObjectStore({
        clock: deps.clock,
        accountName,
        accountKey,
        ...(env.STORAGE_AZURE_BLOB_ENDPOINT ? { endpoint: env.STORAGE_AZURE_BLOB_ENDPOINT } : {}),
        ...(env.STORAGE_AZURE_PUBLIC_CONTAINER
          ? { publicContainer: env.STORAGE_AZURE_PUBLIC_CONTAINER }
          : {}),
        ...(env.STORAGE_AZURE_PRIVATE_CONTAINER
          ? { privateContainer: env.STORAGE_AZURE_PRIVATE_CONTAINER }
          : {}),
        ...(env.STORAGE_PUBLIC_BASE_URL ? { publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL } : {}),
      });
    }
    default:
      return assertNever(env.STORAGE_PROVIDER, 'Unsupported STORAGE_PROVIDER.');
  }
}
