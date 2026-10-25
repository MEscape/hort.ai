import { describe, expect, it } from 'vitest';

import { BetterAuthParentAccess } from '@modules/auth/infrastructure/better-auth/better-auth-parent-access';

function build() {
  let now = new Date('2026-10-25T10:00:00Z');
  let proof: string | undefined;
  let session: {
    user: { id: string; role: string; emailVerified: boolean };
    session: { token: string };
  } | null = {
    user: { id: 'parent-a', role: 'parent', emailVerified: true },
    session: { token: 'session-a' },
  };
  let correct = true;
  const access = new BetterAuthParentAccess({
    clock: { now: () => now },
    secret: 'test-parent-access-secret',
    getHeaders: async () => new Headers(),
    api: { getSession: async () => session, verifyPassword: async () => ({ status: correct }) },
    cookie: {
      read: async () => proof,
      write: async (value) => {
        proof = value;
      },
    },
  });
  return {
    access,
    advance: () => {
      now = new Date(now.getTime() + 300_001);
    },
    expire: () => {
      session = null;
    },
    switchSession: () => {
      if (session) {
        session = { ...session, session: { token: 'session-b' } };
      }
    },
    tamper: () => {
      proof = '9999999999999.fake';
    },
    wrong: () => {
      correct = false;
    },
  };
}

describe('parent access proof', () => {
  it('refuses the family session alone and opens only after password verification', async () => {
    const { access } = build();
    expect((await access.require()).isErr()).toBe(true);
    expect((await access.open('verified-password')).isOk()).toBe(true);
    expect((await access.require()).isOk()).toBe(true);
  });
  it('does not grant a proof when the password is wrong', async () => {
    const { access, wrong } = build();
    wrong();
    expect((await access.open('wrong')).isErr()).toBe(true);
    expect((await access.require()).isErr()).toBe(true);
  });
  it.each(['advance', 'expire', 'switchSession', 'tamper'] as const)(
    'refuses access after %s',
    async (change) => {
      const context = build();
      await context.access.open('password');
      context[change]();
      expect((await context.access.require()).isErr()).toBe(true);
    },
  );
  it('revokes the proof when the device returns to the child', async () => {
    const { access } = build();
    await access.open('password');
    await access.close();
    expect((await access.require()).isErr()).toBe(true);
  });
});
