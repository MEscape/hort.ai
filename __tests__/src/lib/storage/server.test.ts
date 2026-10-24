import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@lib/config/server');
});

describe('getObjectStore', () => {
  it('is null while STORAGE_PROVIDER=none, and built once on first use', async () => {
    vi.doMock('@lib/config/server', () => ({ serverEnv: { STORAGE_PROVIDER: 'none' } }));
    const { getObjectStore } = await import('@lib/storage/server');

    expect(getObjectStore()).toBeNull();
    expect(getObjectStore()).toBeNull();
  });

  it('builds the configured store', async () => {
    vi.doMock('@lib/config/server', () => ({
      serverEnv: {
        STORAGE_PROVIDER: 'azure',
        STORAGE_AZURE_ACCOUNT_NAME: 'devstoreaccount1',
        STORAGE_AZURE_ACCOUNT_KEY: 'a2V5',
        STORAGE_AZURE_PRIVATE_CONTAINER: 'hortai-private',
      },
    }));
    const { getObjectStore } = await import('@lib/storage/server');

    const store = getObjectStore();
    expect(store?.supports('private')).toBe(true);
    expect(getObjectStore()).toBe(store);
  });
});
