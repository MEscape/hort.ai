// @vitest-environment node
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import type { AuthLinkMessage, AuthMailer } from '@modules/auth/domain/ports/auth-mailer.port';
import type { SecurityEvent } from '@modules/auth/domain/ports/security-audit-log.port';

import { systemClock } from '@lib/clock';
import { okAsync } from '@lib/result';

/**
 * The module's Better Auth adapters against the real auth database: the local Postgres from
 * `docker compose up` after `npm run db:migrate`. It reads the application's own `AUTH_DATABASE_URL` and
 * `AUTH_SECRET` and is skipped unless both are set. Mail is captured instead of sent. Every
 * account it creates carries the run's id in its address and is removed afterwards.
 *
 * The cookie the provider sets cannot reach `next/headers` outside a request, so the session is
 * carried by hand: the `Set-Cookie` of a sign-in becomes the `Cookie` of the next request.
 */
const DATABASE_URL = process.env['AUTH_DATABASE_URL'];
const SECRET = process.env['AUTH_SECRET'];
const isEnabled = Boolean(DATABASE_URL) && (SECRET?.length ?? 0) >= 32;

const TENANT = toTenantId('default');
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'a completely different passphrase';
const PATHS = { afterEmailVerification: '/email-verified', passwordReset: '/reset-password' };
const SETTINGS = {
  tenantId: TENANT,
  baseUrl: 'http://localhost:3000',
  secret: SECRET ?? '',
  isProduction: false,
  trustedProxies: [] as string[],
  session: { expiresInSeconds: 3600, updateAgeSeconds: 600, freshAgeSeconds: 300 },
};

async function eventually<T>(read: () => T | undefined, what: string): Promise<T> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const value = read();
    if (value !== undefined) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe.skipIf(!isEnabled)('Better Auth adapters against the auth database', () => {
  const runId = `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `${runId}@example.test`;
  const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

  const mails: Array<AuthLinkMessage & { readonly kind: string }> = [];
  const events: SecurityEvent[] = [];

  let auth: Awaited<ReturnType<typeof build>>['auth'];
  let authenticatorFor: Awaited<ReturnType<typeof build>>['authenticatorFor'];
  let actorFor: Awaited<ReturnType<typeof build>>['actorFor'];
  let userId = '';

  async function build() {
    const { createAuth } = await import('@modules/auth/infrastructure/better-auth/create-auth');
    const { authenticationApiFrom } =
      await import('@modules/auth/infrastructure/better-auth/better-auth-authentication-api');
    const { BetterAuthAuthenticator } =
      await import('@modules/auth/infrastructure/better-auth/better-auth-authenticator');
    const { BetterAuthCurrentActorProvider } =
      await import('@modules/auth/infrastructure/better-auth/better-auth-current-actor-provider');
    const { sessionSourceFrom } =
      await import('@modules/auth/infrastructure/better-auth/better-auth-session-source');

    const capture = (kind: string) => (message: AuthLinkMessage) => {
      mails.push({ kind, ...message });
      return okAsync(undefined);
    };
    const mailer: AuthMailer = {
      sendVerification: capture('verification'),
      sendPasswordReset: capture('password_reset'),
      sendExistingAccountNotice: (message) => {
        mails.push({ kind: 'existing_account', url: '', ...message });
        return okAsync(undefined);
      },
    };
    const instance = createAuth(SETTINGS, {
      pool,
      mailer,
      audit: { record: (event) => events.push(event) },
    });
    const api = authenticationApiFrom(instance);

    return {
      auth: instance,
      /** An authenticator for a request that carries `cookie` (none: an anonymous request). */
      authenticatorFor: (cookie?: string) =>
        new BetterAuthAuthenticator({
          api,
          getHeaders: () => Promise.resolve(new Headers(cookie ? { cookie } : {})),
          paths: PATHS,
        }),
      actorFor: (cookie?: string) =>
        new BetterAuthCurrentActorProvider({
          sessions: sessionSourceFrom(() => instance),
          getHeaders: () => Promise.resolve(new Headers(cookie ? { cookie } : {})),
          sessionMaxLifetimeMs: 24 * 3600 * 1000,
          clock: systemClock,
          tenantId: TENANT,
        }),
    };
  }

  /** What a browser would send back after this sign-in. */
  async function signInAndKeepCookie(password = PASSWORD): Promise<string> {
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });
    return headers
      .getSetCookie()
      .map((line) => line.split(';')[0])
      .join('; ');
  }

  async function tokenFrom(kind: string, afterCount: number): Promise<string> {
    const message = await eventually(
      () => mails.filter((mail) => mail.kind === kind)[afterCount],
      `the ${kind} mail`,
    );
    const url = new URL(message.url);
    return url.searchParams.get('token') ?? url.pathname.split('/').at(-1) ?? '';
  }

  beforeAll(async () => {
    ({ auth, authenticatorFor, actorFor } = await build());
  });

  afterAll(async () => {
    await pool.query('DELETE FROM "verification" WHERE "value" = $1 OR "identifier" LIKE $2', [
      userId,
      `%${runId}%`,
    ]);
    await pool.query('DELETE FROM "user" WHERE "email" = $1', [email]);
    await pool.end();
  });

  it('creates an account that cannot sign in until its address is confirmed', async () => {
    const created = await authenticatorFor().signUp({ name: 'Mara', email, password: PASSWORD, role: 'parent' });
    const verification = await tokenFrom('verification', 0);

    expect(created.isOk()).toBe(true);
    expect(verification.length).toBeGreaterThan(20);
    const row = await pool.query('SELECT "id", "emailVerified" FROM "user" WHERE "email" = $1', [
      email,
    ]);
    userId = String(row.rows[0]?.id);
    expect(row.rows[0]?.emailVerified).toBe(false);

    const tooEarly = await authenticatorFor().signIn({ email, password: PASSWORD });

    expect(tooEarly.isErr() && tooEarly.error).toMatchObject({
      kind: 'forbidden',
      code: 'auth.email_not_verified',
    });
    expect((await actorFor().getCurrentActor()).isErr()).toBe(true);
  });

  it('records the account, and the refused sign-in, with the tenant and without the address', async () => {
    const created = events.find((event) => event.type === 'authentication.account_created');
    const refused = events.find((event) => event.type === 'authentication.sign_in_failed');

    expect(created).toEqual({
      type: 'authentication.account_created',
      actorId: userId,
      tenantId: TENANT,
    });
    expect(refused).toEqual({
      type: 'authentication.sign_in_failed',
      tenantId: TENANT,
      errorCode: 'auth.email_not_verified',
    });
    expect(JSON.stringify(events)).not.toContain(email);
  });

  it('answers a repeated sign-up like a first one, tells the owner by mail, and creates no second account', async () => {
    const repeated = await authenticatorFor().signUp({
      name: 'Someone else',
      email,
      password: NEW_PASSWORD,
      role: 'teacher',
    });

    expect(repeated.isOk()).toBe(true);
    await eventually(() => mails.find((mail) => mail.kind === 'existing_account'), 'the notice');
    const count = await pool.query('SELECT count(*)::int AS n FROM "user" WHERE "email" = $1', [
      email,
    ]);
    expect(count.rows[0]?.n).toBe(1);
    // The attempt did not change the password of the account that exists.
    const stillOld = await pool.query('SELECT 1 FROM "account" WHERE "userId" = $1', [userId]);
    expect(stillOld.rowCount).toBe(1);
  });

  it('signs in after confirmation and resolves the session to a parent of the configured tenant', async () => {
    await auth.api.verifyEmail({ query: { token: await tokenFrom('verification', 0) } });

    const cookie = await signInAndKeepCookie();
    const actor = await actorFor(cookie).getCurrentActor();

    expect(actor.isOk() && actor.value).toEqual({
      id: userId,
      tenantId: 'default',
      roles: ['parent'],
    });
    expect(events.some((event) => event.type === 'authentication.session_created')).toBe(true);
  });

  it('does not accept a cookie it did not issue, or one that was altered', async () => {
    const cookie = await signInAndKeepCookie();
    const [name = '', value = ''] = cookie.split('=');
    const altered = `${name}=${value.slice(0, -3)}AAA`;

    expect(
      (await actorFor('better-auth.session_token=forged.value').getCurrentActor()).isErr(),
    ).toBe(true);
    expect((await actorFor(altered).getCurrentActor()).isErr()).toBe(true);
    expect((await actorFor(cookie).getCurrentActor()).isOk()).toBe(true);
  });

  it('answers a wrong password and an unknown account in the same way', async () => {
    const wrong = await authenticatorFor().signIn({ email, password: 'not the password at all' });
    const unknown = await authenticatorFor().signIn({
      email: `nobody-${runId}@example.test`,
      password: PASSWORD,
    });

    expect(wrong).toEqual(unknown);
    expect(wrong.isErr() && wrong.error.code).toBe('auth.invalid_credentials');
  });

  it('revokes the session at sign-out: the same cookie is signed out at once', async () => {
    const cookie = await signInAndKeepCookie();
    expect((await actorFor(cookie).getCurrentActor()).isOk()).toBe(true);

    const result = await authenticatorFor(cookie).signOut();

    expect(result.isOk()).toBe(true);
    const afterwards = await actorFor(cookie).getCurrentActor();
    expect(afterwards.isErr() && afterwards.error.code).toBe('auth.unauthenticated');
    await eventually(
      () => events.find((event) => event.type === 'authentication.session_revoked'),
      'the revoked-session event',
    );
  });

  it('signs out without a session as a no-op', async () => {
    expect((await authenticatorFor().signOut()).isOk()).toBe(true);
  });

  it('resets a password once: the link is single-use and every session ends', async () => {
    const oldSession = await signInAndKeepCookie();
    await authenticatorFor().requestPasswordReset({ email });
    const token = await tokenFrom('password_reset', 0);

    const reset = await authenticatorFor().resetPassword({ token, newPassword: NEW_PASSWORD });
    const again = await authenticatorFor().resetPassword({
      token,
      newPassword: 'yet another passphrase!',
    });

    expect(reset.isOk()).toBe(true);
    expect(again.isErr() && again.error.code).toBe('auth.invalid_token');
    expect((await actorFor(oldSession).getCurrentActor()).isErr()).toBe(true);
    const oldPassword = await authenticatorFor().signIn({ email, password: PASSWORD });
    expect(oldPassword.isErr() && oldPassword.error.code).toBe('auth.invalid_credentials');
    expect((await actorFor(await signInAndKeepCookie(NEW_PASSWORD)).getCurrentActor()).isOk()).toBe(
      true,
    );
    expect(events).toContainEqual({
      type: 'authentication.password_reset_completed',
      actorId: userId,
      tenantId: TENANT,
    });
  });

  it('asks for a reset link for an unknown address without telling, and sends nothing', async () => {
    const before = mails.length;

    const result = await authenticatorFor().requestPasswordReset({
      email: `nobody-${runId}@example.test`,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(result.isOk()).toBe(true);
    expect(mails).toHaveLength(before);
  });

  it('never put a credential in an audit event', () => {
    const text = JSON.stringify(events);

    for (const secret of [PASSWORD, NEW_PASSWORD, 'token', 'cookie', 'session_token']) {
      expect(text).not.toContain(secret);
    }
  });
});
