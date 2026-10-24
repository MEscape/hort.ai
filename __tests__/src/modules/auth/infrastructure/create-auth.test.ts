import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { mailerNotConfigured } from '@modules/auth/domain/errors/auth-errors';
import type { AuthMailer } from '@modules/auth/domain/ports/auth-mailer.port';
import { createAuth } from '@modules/auth/infrastructure/better-auth/create-auth';
import type { AuthSettings } from '@modules/auth/infrastructure/better-auth/create-auth';
import { UnconfiguredAuthMailer } from '@modules/auth/infrastructure/mail/unconfigured-auth-mailer';

import { errAsync, okAsync } from '@lib/result';

import { TENANT, recordingAudit } from '../fakes';

const SETTINGS: AuthSettings = {
  tenantId: TENANT,
  baseUrl: 'https://hortai.example',
  secret: 's'.repeat(48),
  isProduction: true,
  trustedProxies: ['10.0.0.0/8'],
  session: { expiresInSeconds: 604_800, updateAgeSeconds: 86_400, freshAgeSeconds: 900 },
};

// A pool opens no connection until it is asked for one, so building the instance needs no database.
const pool = new Pool({ connectionString: 'postgresql://user:pass@localhost:5432/unused' });

const mailer: AuthMailer = {
  sendVerification: () => okAsync(undefined),
  sendPasswordReset: () => okAsync(undefined),
  sendExistingAccountNotice: () => errAsync(mailerNotConfigured()),
};

function options(settings: AuthSettings = SETTINGS) {
  return createAuth(settings, { pool, mailer, audit: recordingAudit() }).options;
}

afterAll(async () => {
  await pool.end();
});

describe('createAuth security defaults', () => {
  it('requires a confirmed address before anyone can sign in', () => {
    expect(options().emailAndPassword?.requireEmailVerification).toBe(true);
    expect(options().emailVerification?.sendOnSignUp).toBe(true);
  });

  it('keeps the provider ready to be reached only through the use cases: raw sign-up is disabled', () => {
    expect(options().disabledPaths).toContain('/sign-up/email');
  });

  it('enforces the password length the domain states', () => {
    expect(options().emailAndPassword).toMatchObject({
      minPasswordLength: 12,
      maxPasswordLength: 128,
    });
  });

  it('revokes every session when a password is reset', () => {
    expect(options().emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });

  it('never caches a session in a cookie, so a revoked session stops working at once', () => {
    expect(options().session?.cookieCache?.enabled).toBe(false);
  });

  it('leaves rate limiting to the platform limiter, so an attempt is counted once', () => {
    expect(options().rateLimit?.enabled).toBe(false);
  });

  it('trusts only its own origin and sets the base URL explicitly', () => {
    expect(options()).toMatchObject({
      baseURL: 'https://hortai.example',
      trustedOrigins: ['https://hortai.example'],
    });
  });

  it('uses http-only, same-site cookies, secure in production only', () => {
    expect(options().advanced).toMatchObject({
      useSecureCookies: true,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    });
    expect(options({ ...SETTINGS, isProduction: false }).advanced?.useSecureCookies).toBe(false);
  });

  it('takes the session lifetimes from configuration', () => {
    expect(options().session).toMatchObject({
      expiresIn: 604_800,
      updateAge: 86_400,
      freshAge: 900,
    });
  });
});

describe('UnconfiguredAuthMailer', () => {
  it('fails every send loudly, so a missing mail transport cannot look like a working one', async () => {
    const unconfigured: AuthMailer = new UnconfiguredAuthMailer();
    const message = {
      to: 'mara@example.org',
      url: 'https://x/y?token=SECRET',
      locale: 'en' as const,
    };

    for (const result of await Promise.all([
      unconfigured.sendVerification(message),
      unconfigured.sendPasswordReset(message),
      unconfigured.sendExistingAccountNotice({ to: message.to, locale: message.locale }),
    ])) {
      expect(result.isErr() && result.error.code).toBe('auth.mailer_not_configured');
    }
  });
});
