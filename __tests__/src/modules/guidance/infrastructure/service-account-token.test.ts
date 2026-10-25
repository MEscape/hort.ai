import { createPublicKey, createVerify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createServiceAccountTokenSource } from '@modules/guidance/infrastructure/vertex/service-account-token';

import { TEST_PRIVATE_KEY, json, scriptedFetch, timeoutError } from './vertex-fetch';

const CREDENTIALS = {
  clientEmail: 'hortai@p.iam.gserviceaccount.com',
  privateKey: TEST_PRIVATE_KEY,
};
const NOW = Date.UTC(2026, 9, 25, 12);
const TOKEN = { access_token: 'ya29.token', expires_in: 3599, token_type: 'Bearer' };

function source(fetch: typeof globalThis.fetch, now = () => NOW) {
  return createServiceAccountTokenSource(CREDENTIALS, { timeoutMs: 1000, fetch, now });
}

const segment = (part: string | undefined): unknown =>
  JSON.parse(Buffer.from(part ?? '', 'base64url').toString());

describe('createServiceAccountTokenSource', () => {
  it('exchanges a JWT signed with the account key for an access token', async () => {
    const { fetch, calls } = scriptedFetch(json(TOKEN));

    const token = await source(fetch)();

    expect(token._unsafeUnwrap()).toBe('ya29.token');
    expect(calls[0]?.url).toBe('https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(calls[0]?.body ?? '');
    expect(form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    const [header, claims, signature] = String(form.get('assertion')).split('.');
    expect(segment(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(segment(claims)).toEqual({
      iss: CREDENTIALS.clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: NOW / 1000,
      exp: NOW / 1000 + 3600,
    });
    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(createPublicKey(TEST_PRIVATE_KEY), Buffer.from(signature ?? '', 'base64url'));
    expect(verified).toBe(true);
  });

  it('reuses the token until shortly before it expires', async () => {
    let now = NOW;
    const { fetch, calls } = scriptedFetch(json(TOKEN), json({ ...TOKEN, access_token: 'next' }));
    const tokens = source(fetch, () => now);

    await tokens();
    now += 3000 * 1000;
    expect((await tokens())._unsafeUnwrap()).toBe('ya29.token');
    now += 600 * 1000;
    expect((await tokens())._unsafeUnwrap()).toBe('next');
    expect(calls).toHaveLength(2);
  });

  it('reports a refused exchange with its status only, never the key', async () => {
    const { fetch } = scriptedFetch(json({ error: 'invalid_grant' }, 400));

    const failure = (await source(fetch)())._unsafeUnwrapErr();

    expect(failure.kind).toBe('unavailable');
    expect(String(failure.kind === 'unavailable' && failure.cause)).toContain('400');
    expect(JSON.stringify(failure)).not.toContain('PRIVATE KEY');
  });

  it('reports an unknown answer and a broken connection as unavailable', async () => {
    const { fetch } = scriptedFetch(json({ token: 'x' }), new TypeError('fetch failed: secret'));
    const tokens = source(fetch);

    expect((await tokens())._unsafeUnwrapErr().kind).toBe('unavailable');
    const broken = (await tokens())._unsafeUnwrapErr();
    expect(broken.kind === 'unavailable' && String(broken.cause)).not.toContain('secret');
  });

  it('reports a missed deadline as timeout', async () => {
    const { fetch } = scriptedFetch(timeoutError());

    expect((await source(fetch)())._unsafeUnwrapErr()).toEqual({ kind: 'timeout' });
  });
});
