import { afterEach, describe, expect, it, vi } from 'vitest';

import { register } from '@/instrumentation';

const loaded = vi.hoisted(() => ({ config: 0, startAuditRetention: vi.fn() }));

vi.mock('@lib/config/server', () => {
  loaded.config += 1;
  return { serverEnv: {} };
});
vi.mock('@modules/audit', () => ({ startAuditRetention: loaded.startAuditRetention }));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('register', () => {
  it('does nothing outside the Node.js runtime', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');

    await register();

    expect(loaded.config).toBe(0);
    expect(loaded.startAuditRetention).not.toHaveBeenCalled();
  });

  it('validates the server configuration and starts the audit retention once, on Node.js', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');

    await register();

    expect(loaded.config).toBe(1);
    expect(loaded.startAuditRetention).toHaveBeenCalledOnce();
  });
});
