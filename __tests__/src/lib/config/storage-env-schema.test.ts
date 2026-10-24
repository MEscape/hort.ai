import { describe, expect, it } from 'vitest';

import { storageEnvSchema } from '@lib/config/storage-env-schema';

/** Microsoft's published Azurite credentials: public by design. */
const AZURITE_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

const valid = {
  STORAGE_PROVIDER: 'azure',
  STORAGE_AZURE_ACCOUNT_NAME: 'devstoreaccount1',
  STORAGE_AZURE_ACCOUNT_KEY: AZURITE_KEY,
  STORAGE_AZURE_PUBLIC_CONTAINER: 'hortai-public',
  STORAGE_AZURE_PRIVATE_CONTAINER: 'hortai-private',
  STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.org/hortai-public',
};

/** The variables a failed parse complains about. */
function problems(env: Record<string, string | undefined>): string[] {
  const result = storageEnvSchema.safeParse(env);
  return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
}

describe('storageEnvSchema', () => {
  it('defaults to no storage at all', () => {
    expect(storageEnvSchema.parse({})).toEqual({ STORAGE_PROVIDER: 'none' });
  });

  it('accepts a complete Azure configuration, with or without an endpoint override', () => {
    expect(problems(valid)).toEqual([]);
    expect(
      problems({
        ...valid,
        STORAGE_AZURE_BLOB_ENDPOINT: 'http://127.0.0.1:10000/devstoreaccount1',
      }),
    ).toEqual([]);
  });

  it('accepts a private-only configuration without a public origin', () => {
    const {
      STORAGE_AZURE_PUBLIC_CONTAINER: _public,
      STORAGE_PUBLIC_BASE_URL: _base,
      ...privateOnly
    } = valid;

    expect(problems(privateOnly)).toEqual([]);
  });

  it('no longer knows the S3 provider', () => {
    expect(problems({ STORAGE_PROVIDER: 's3' })).toEqual(['STORAGE_PROVIDER']);
  });

  it.each([
    'STORAGE_AZURE_ACCOUNT_NAME',
    'STORAGE_AZURE_ACCOUNT_KEY',
    'STORAGE_AZURE_BLOB_ENDPOINT',
    'STORAGE_AZURE_PUBLIC_CONTAINER',
    'STORAGE_AZURE_PRIVATE_CONTAINER',
    'STORAGE_PUBLIC_BASE_URL',
  ])('rejects %s while the provider is "none"', (name) => {
    expect(
      problems({ [name]: valid[name as keyof typeof valid] ?? 'https://example.org' }),
    ).toContain(name);
  });

  it('requires the account name, the key and at least one container', () => {
    expect(problems({ STORAGE_PROVIDER: 'azure' })).toEqual([
      'STORAGE_AZURE_ACCOUNT_NAME',
      'STORAGE_AZURE_ACCOUNT_KEY',
      'STORAGE_AZURE_PUBLIC_CONTAINER',
    ]);
  });

  it('validates the shape of names and the key', () => {
    expect(problems({ ...valid, STORAGE_AZURE_ACCOUNT_NAME: 'Dev_Store' })).toEqual([
      'STORAGE_AZURE_ACCOUNT_NAME',
    ]);
    expect(problems({ ...valid, STORAGE_AZURE_ACCOUNT_KEY: 'not a key' })).toEqual([
      'STORAGE_AZURE_ACCOUNT_KEY',
    ]);
    expect(problems({ ...valid, STORAGE_AZURE_PUBLIC_CONTAINER: 'two--hyphens' })).toEqual([
      'STORAGE_AZURE_PUBLIC_CONTAINER',
    ]);
    expect(problems({ ...valid, STORAGE_AZURE_PRIVATE_CONTAINER: 'Upper' })).toEqual([
      'STORAGE_AZURE_PRIVATE_CONTAINER',
    ]);
  });

  it('keeps private objects out of the public container', () => {
    expect(problems({ ...valid, STORAGE_AZURE_PRIVATE_CONTAINER: 'hortai-public' })).toEqual([
      'STORAGE_AZURE_PRIVATE_CONTAINER',
    ]);
  });

  it('ties the public origin to the public container', () => {
    const { STORAGE_PUBLIC_BASE_URL: _base, ...withoutBase } = valid;
    const { STORAGE_AZURE_PUBLIC_CONTAINER: _public, ...withoutPublic } = valid;

    expect(problems(withoutBase)).toEqual(['STORAGE_PUBLIC_BASE_URL']);
    expect(problems(withoutPublic)).toEqual(['STORAGE_PUBLIC_BASE_URL']);
  });

  it.each([
    ['STORAGE_PUBLIC_BASE_URL', 'https://user:pw@cdn.example.org'],
    ['STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.org/?x=1'],
    ['STORAGE_PUBLIC_BASE_URL', 'https://cdn.example.org/#top'],
    ['STORAGE_AZURE_BLOB_ENDPOINT', 'https://acct.blob.core.windows.net/?sv=1'],
  ])('keeps credentials, queries and fragments out of %s (%s)', (name, value) => {
    expect(problems({ ...valid, [name]: value })).toEqual([name]);
  });
});
