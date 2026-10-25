import { createSign } from 'node:crypto';

import { err, ok, ResultAsync } from '@lib/result';
import type { Result } from '@lib/result';
import { buildQueryString, isFiniteNumber, isString, objectOf } from '@lib/utils';

import type { HintProviderFailure } from '../../domain/ports/hint-provider.port';

/** Google's OAuth 2.0 token endpoint for the service-account (JWT bearer) flow. */
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const ASSERTION_LIFETIME_SECONDS = 3600;
/** A token is renewed this long before it expires, so a request never carries one that lapses on the way. */
const RENEW_BEFORE_SECONDS = 60;
const MS_PER_SECOND = 1000;

export interface ServiceAccountCredentials {
  readonly clientEmail: string;
  /** PEM private key from the service account's JSON key file. Never logged. */
  readonly privateKey: string;
}

export interface ServiceAccountTokenOptions {
  readonly timeoutMs: number;
  /** Injected in tests; the global `fetch` otherwise. */
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

/** A source of short-lived access tokens; it fails when Google refuses or misses the exchange. */
export type AccessTokenSource = () => ResultAsync<string, HintProviderFailure>;

const isTokenResponse = objectOf<{ access_token: string; expires_in: number }>({
  access_token: isString,
  expires_in: isFiniteNumber,
});

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** The signed JWT that the token endpoint exchanges for an access token. */
function assertionFor(credentials: ServiceAccountCredentials, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: CLOUD_PLATFORM_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + ASSERTION_LIFETIME_SECONDS,
    }),
  );
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(credentials.privateKey);
  return `${header}.${claims}.${base64url(signature)}`;
}

const unavailable = (message: string): HintProviderFailure => ({
  kind: 'unavailable',
  cause: new Error(message),
});

/**
 * A thrown value reaches the cause by its name only: its message may echo a request. A missed
 * deadline is `timeout`.
 */
export function failureOf(operation: string, thrown: unknown): HintProviderFailure {
  const name = thrown instanceof Error ? thrown.name : 'unknown error';
  return name === 'TimeoutError'
    ? { kind: 'timeout' }
    : unavailable(`${operation} could not be completed: ${name}`);
}

/**
 * Access tokens for a Google service account, by the OAuth 2.0 JWT bearer flow: a JWT signed with
 * the account's private key is exchanged for a token valid for about an hour. The token is kept
 * and reused until shortly before it expires. Plain `fetch` and `node:crypto`; one exchange does
 * not justify Google's auth library. Errors carry the HTTP status only, never the key or a token.
 */
export function createServiceAccountTokenSource(
  credentials: ServiceAccountCredentials,
  options: ServiceAccountTokenOptions,
): AccessTokenSource {
  const send = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let cached: { readonly token: string; readonly renewAt: number } | null = null;

  async function exchange(): Promise<Result<string, HintProviderFailure>> {
    if (cached !== null && now() < cached.renewAt) {
      return ok(cached.token);
    }
    const nowSeconds = Math.floor(now() / MS_PER_SECOND);
    let body: unknown;
    try {
      const response = await send(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildQueryString({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: assertionFor(credentials, nowSeconds),
        }).slice(1),
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        return err(unavailable(`Google token exchange failed with status ${response.status}`));
      }
      body = await response.json();
    } catch (thrown) {
      return err(failureOf('Google token exchange', thrown));
    }
    if (!isTokenResponse(body)) {
      return err(unavailable('Google token exchange returned an unknown shape.'));
    }
    cached = {
      token: body.access_token,
      renewAt: (nowSeconds + body.expires_in - RENEW_BEFORE_SECONDS) * MS_PER_SECOND,
    };
    return ok(cached.token);
  }

  return () => ResultAsync.fromSafePromise(exchange()).andThen((outcome) => outcome);
}
