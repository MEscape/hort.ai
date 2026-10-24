import { z } from 'zod';

import { httpUrl } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';

/** Azure storage account names: 3-24 characters, lower-case letters and digits only. */
const accountName = z.string().regex(/^[a-z0-9]{3,24}$/, {
  error: 'Must be a 3-24 character storage account name of lower-case letters and digits.',
});

/** Azure container names: 3-63 characters, lower-case letters, digits and single hyphens. */
const containerName = z.string().regex(/^(?!.*--)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
  error:
    'Must be a 3-63 character container name of lower-case letters, digits and single "-", starting and ending with a letter or digit.',
});

/** A storage account key is a base64 string (64 bytes, so 88 characters, in practice). */
const accountKey = z.string().regex(/^[A-Za-z0-9+/]{43,}={0,2}$/, {
  error: 'Must be the base64 key of the storage account.',
});

const storageEnvObjectSchema = z.object({
  /** `none` turns media uploads off: nothing is stored and the upload UI stays hidden. */
  STORAGE_PROVIDER: z.enum(['none', 'azure']).default('none'),
  STORAGE_AZURE_ACCOUNT_NAME: accountName.optional(),
  /** Signs the short-lived SAS URLs. Server-only and powerful: never log it, never ship it to the browser. */
  STORAGE_AZURE_ACCOUNT_KEY: accountKey.optional(),
  /**
   * The Blob service URL, without a container. Unset means `https://<account>.blob.core.windows.net`.
   * Set it for the Azurite emulator, whose URL carries the account name as its first path segment.
   */
  STORAGE_AZURE_BLOB_ENDPOINT: httpUrl.optional(),
  /** Holds public objects; its whole content is readable through `STORAGE_PUBLIC_BASE_URL`. */
  STORAGE_AZURE_PUBLIC_CONTAINER: containerName.optional(),
  /** Holds private objects, readable only through short-lived SAS URLs. Must not allow anonymous access. */
  STORAGE_AZURE_PRIVATE_CONTAINER: containerName.optional(),
  /** The origin (or CDN domain) that serves the public container, including the container when the origin does not. */
  STORAGE_PUBLIC_BASE_URL: httpUrl.optional(),
});

export type StorageEnv = z.infer<typeof storageEnvObjectSchema>;

type StorageVariable = keyof StorageEnv;

/** Every variable that only means something once `STORAGE_PROVIDER=azure`. */
const PROVIDER_VARIABLES = [
  'STORAGE_AZURE_ACCOUNT_NAME',
  'STORAGE_AZURE_ACCOUNT_KEY',
  'STORAGE_AZURE_BLOB_ENDPOINT',
  'STORAGE_AZURE_PUBLIC_CONTAINER',
  'STORAGE_AZURE_PRIVATE_CONTAINER',
  'STORAGE_PUBLIC_BASE_URL',
] as const satisfies readonly StorageVariable[];

const usesAzure = (env: StorageEnv) => env.STORAGE_PROVIDER === 'azure';

/** A public origin is a place, not a request: credentials, a query or a fragment do not belong in it. */
const carriesMoreThanAPlace = (url: string) => {
  const { username, password, search, hash } = new URL(url);
  return Boolean(username || password || search || hash);
};

/**
 * Object storage, shared by every module that stores files. Everything a provider needs is
 * required as soon as it is chosen, and settings for a provider that is not chosen are an error
 * rather than silently ignored: a forgotten `STORAGE_PROVIDER` must not look like a working
 * deployment that stores nothing.
 */
export const storageEnvRules: ReadonlyArray<EnvRule<StorageEnv>> = [
  ...PROVIDER_VARIABLES.map((name): EnvRule<StorageEnv> => ({
    path: name,
    violated: (env) => env.STORAGE_PROVIDER === 'none' && env[name] !== undefined,
    message: `${name} is set but STORAGE_PROVIDER is "none". Set it to "azure".`,
  })),
  {
    path: 'STORAGE_AZURE_ACCOUNT_NAME',
    violated: (env) => usesAzure(env) && !env.STORAGE_AZURE_ACCOUNT_NAME,
    message: 'STORAGE_AZURE_ACCOUNT_NAME is required when STORAGE_PROVIDER is "azure".',
  },
  {
    path: 'STORAGE_AZURE_ACCOUNT_KEY',
    violated: (env) => usesAzure(env) && !env.STORAGE_AZURE_ACCOUNT_KEY,
    message: 'STORAGE_AZURE_ACCOUNT_KEY is required when STORAGE_PROVIDER is "azure".',
  },
  {
    path: 'STORAGE_AZURE_PUBLIC_CONTAINER',
    violated: (env) =>
      usesAzure(env) && !env.STORAGE_AZURE_PUBLIC_CONTAINER && !env.STORAGE_AZURE_PRIVATE_CONTAINER,
    message: 'Set STORAGE_AZURE_PUBLIC_CONTAINER, STORAGE_AZURE_PRIVATE_CONTAINER or both.',
  },
  {
    path: 'STORAGE_AZURE_PRIVATE_CONTAINER',
    violated: (env) =>
      usesAzure(env) &&
      Boolean(env.STORAGE_AZURE_PUBLIC_CONTAINER) &&
      env.STORAGE_AZURE_PUBLIC_CONTAINER === env.STORAGE_AZURE_PRIVATE_CONTAINER,
    message:
      'The private container must differ from the public one, or private objects would be served publicly.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) =>
      usesAzure(env) && Boolean(env.STORAGE_AZURE_PUBLIC_CONTAINER) && !env.STORAGE_PUBLIC_BASE_URL,
    message: 'STORAGE_PUBLIC_BASE_URL is required when STORAGE_AZURE_PUBLIC_CONTAINER is set.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) =>
      usesAzure(env) && Boolean(env.STORAGE_PUBLIC_BASE_URL) && !env.STORAGE_AZURE_PUBLIC_CONTAINER,
    message:
      'STORAGE_PUBLIC_BASE_URL is set but there is no STORAGE_AZURE_PUBLIC_CONTAINER to serve.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) =>
      usesAzure(env) &&
      env.STORAGE_PUBLIC_BASE_URL !== undefined &&
      carriesMoreThanAPlace(env.STORAGE_PUBLIC_BASE_URL),
    message: 'STORAGE_PUBLIC_BASE_URL must not contain credentials, a query or a fragment.',
  },
  {
    path: 'STORAGE_AZURE_BLOB_ENDPOINT',
    violated: (env) =>
      usesAzure(env) &&
      env.STORAGE_AZURE_BLOB_ENDPOINT !== undefined &&
      carriesMoreThanAPlace(env.STORAGE_AZURE_BLOB_ENDPOINT),
    message: 'STORAGE_AZURE_BLOB_ENDPOINT must not contain credentials, a query or a fragment.',
  },
];

export const storageEnvSchema = storageEnvObjectSchema.superRefine(refineEnv(storageEnvRules));
