import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Clock } from '@lib/clock';
import { fromThrowableAsync, errAsync, okAsync } from '@lib/result';
import { SECONDS_PER_MINUTE, MS_PER_MINUTE } from '@lib/utils';

import {
  invalidCredentials,
  providerFailed,
  reauthenticationRequired,
  unauthenticated,
} from '../../domain/errors/auth-errors';

import { narrowAuthenticatorError } from './better-auth-authenticator';
import { mapBetterAuthError } from './map-better-auth-error';

import type { ParentAccessPort } from '../../domain/ports/parent-access.port';

interface ParentSession {
  readonly user: { readonly id: string; readonly role?: unknown; readonly emailVerified: boolean };
  readonly session: { readonly token: string };
}
interface ParentAccessOptions {
  readonly api: {
    getSession(input: { headers: Headers }): Promise<ParentSession | null>;
    verifyPassword(input: {
      body: { password: string };
      headers: Headers;
    }): Promise<{ status: boolean }>;
  };
  readonly getHeaders: () => Promise<Headers>;
  readonly cookie: {
    read(): Promise<string | undefined>;
    write(value: string, maxAge: number): Promise<void>;
  };
  readonly clock: Clock;
  readonly secret: string;
}

const ACCESS_MINUTES = 5;
const ACCESS_TTL_MS = ACCESS_MINUTES * MS_PER_MINUTE;

/** Password verified by Better Auth; signed HttpOnly proof cannot outlive or transfer between sessions. */
export class BetterAuthParentAccess implements ParentAccessPort {
  constructor(private readonly options: ParentAccessOptions) {}

  open(password: string) {
    return this.session()
      .andThen((session) =>
        fromThrowableAsync(
          async () => {
            const result = await this.options.api.verifyPassword({
              body: { password },
              headers: await this.options.getHeaders(),
            });
            if (!result.status) {
              return false;
            }
            const expires = this.options.clock.now().getTime() + ACCESS_TTL_MS;
            await this.options.cookie.write(
              `${expires}.${this.signature(session, expires)}`,
              ACCESS_MINUTES * SECONDS_PER_MINUTE,
            );
            return true;
          },
          (cause) => mapBetterAuthError(cause, providerFailed),
        ).andThen((verified) => (verified ? okAsync(undefined) : errAsync(invalidCredentials()))),
      )
      .mapErr(narrowAuthenticatorError);
  }

  require() {
    return this.session().andThen((session) =>
      fromThrowableAsync(async () => {
        const proof = await this.options.cookie.read();
        if (!proof) {
          return false;
        }
        const [rawExpires, signature] = proof.split('.');
        const expires = Number(rawExpires);
        const now = this.options.clock.now().getTime();
        if (
          !Number.isSafeInteger(expires) ||
          expires <= now ||
          expires > now + ACCESS_TTL_MS ||
          !signature
        ) {
          return false;
        }
        const expected = Buffer.from(this.signature(session, expires));
        const supplied = Buffer.from(signature);
        return supplied.length === expected.length && timingSafeEqual(supplied, expected);
      }, providerFailed).andThen((allowed) =>
        allowed ? okAsync(undefined) : errAsync(reauthenticationRequired()),
      ),
    );
  }

  close() {
    return fromThrowableAsync(() => this.options.cookie.write('', 0), providerFailed);
  }

  private session() {
    return fromThrowableAsync(
      async () => this.options.api.getSession({ headers: await this.options.getHeaders() }),
      providerFailed,
    ).andThen((session) =>
      session?.user.emailVerified && session.user.role === 'parent'
        ? okAsync(session)
        : errAsync(unauthenticated()),
    );
  }

  private signature(session: ParentSession, expires: number) {
    return createHmac('sha256', this.options.secret)
      .update(
        JSON.stringify(['hortai.parent-access', session.user.id, session.session.token, expires]),
      )
      .digest('base64url');
  }
}
