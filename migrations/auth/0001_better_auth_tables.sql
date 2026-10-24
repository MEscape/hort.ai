-- Auth database (the one AUTH_DATABASE_URL points at, owned by `pg`, not Prisma).
-- Applied by `npm run db:migrate:auth` together with the other files in this folder.
--
-- Better Auth's own tables, for the options the application's Better Auth setup uses:
-- e-mail and password, sessions and verification links. Better Auth's built-in rate limiter is switched off;
-- rate limiting is the platform's (@lib/rate-limit, Upstash Redis), so there is no
-- rate limit table here.
-- Compiled from the library's schema generator for exactly those options and
-- made idempotent. If an option or a plugin changes the schema, add a new
-- numbered migration; never edit an applied one.
--
-- The "user" table may be read by the application; everything else only by Better Auth itself.

CREATE TABLE IF NOT EXISTS "user" (
                                      "id"            text        NOT NULL PRIMARY KEY,
                                      "name"          text        NOT NULL,
                                      "email"         text        NOT NULL UNIQUE,
                                      "emailVerified" boolean     NOT NULL,
                                      "image"         text,
                                      "createdAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                      "updatedAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "session" (
                                         "id"        text        NOT NULL PRIMARY KEY,
                                         "expiresAt" timestamptz NOT NULL,
                                         "token"     text        NOT NULL UNIQUE,
                                         "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                         "updatedAt" timestamptz NOT NULL,
                                         "ipAddress" text,
                                         "userAgent" text,
                                         "userId"    text        NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS "account" (
                                         "id"                    text        NOT NULL PRIMARY KEY,
                                         "accountId"             text        NOT NULL,
                                         "providerId"            text        NOT NULL,
                                         "userId"                text        NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    "accessToken"           text,
    "refreshToken"          text,
    "idToken"               text,
    "accessTokenExpiresAt"  timestamptz,
    "refreshTokenExpiresAt" timestamptz,
    "scope"                 text,
    "password"              text,
    "createdAt"             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             timestamptz NOT NULL
    );

CREATE TABLE IF NOT EXISTS "verification" (
                                              "id"         text        NOT NULL PRIMARY KEY,
                                              "identifier" text        NOT NULL,
                                              "value"      text        NOT NULL,
                                              "expiresAt"  timestamptz NOT NULL,
                                              "createdAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                                              "updatedAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");