# Rate limiting

Budgets for operations anyone can repeat, or that cost something per run (sending mail, calling an external system, signing people in). Owning rule: [`security.md`](../rules/security.md). Procedure: [`adding-a-rate-limit.md`](../conventions/adding-a-rate-limit.md). Code: [`src/lib/rate-limit`](../../src/lib/README.md#lib-rate-limit).

## Shape

- **A policy is data.** `RateLimitPolicy` (`id`, `limit`, `windowSeconds`, `onBackendFailure`, `onUnresolvedClient`) is declared in the module's `application/rate-limits.ts` and spent by a use case. Actions, route handlers and adapters never call the limiter.
- **The limiter is a shared port.** `RateLimiter` is imported as a type by every layer and handed in; only `composition.ts` files call `getRateLimiter()` and `getClientAddressProvider()`.
- **A subject says who is counted**: `actor` (from the authorized `Actor`), `client` (an address resolved from trusted request metadata), `identifier` (an account identifier, normalised), `unresolved-client`, or `global`. Never a raw request value.
- **Counters hold keyed hashes.** `buildBucketKey(policyId, subject, secret)` is an HMAC; no address, e-mail or user id is stored. Every instance must share `RATE_LIMIT_SECRET`, otherwise one limit silently becomes one per instance.

## Counting

Fixed window, counted by the store in one atomic step. Attempts `1..limit` pass; later ones are refused, are still counted, and do not extend the window. `retryAfterSeconds` is the time left, rounded up to at least 1, and becomes the `Retry-After` header of the `429` response. Windows start at the first attempt, so up to twice `limit` attempts can cross a window boundary: combine a short and a long window where a burst matters.

## Paid providers

A budget per actor or per child does not cap what many accounts spend together, so every paid call also spends a `global` budget, and a short window has a daily one next to it:

- **AI (guidance)**: hints, answer checks and session starts (which call the topic classifier) spend the child's ten-minute and daily window, the parent account's `guidance.ai-calls-account-hourly` (150) and the global `guidance.ai-calls-hourly`. `services/child-budget.ts` adds the daily, the account and the global request to the policy a use case names, in one `enforceAll`, child first and account second, so neither a child out of budget nor one account with many profiles counts against everyone.
- **Speech (voice)**: a real synthesis spends the global daily character budget `voice.daily-characters`, counted in units of 100 characters (`application/services/speech-budget.ts`). Synthesized audio is cached by a hash of voice and text in the private clip store, so a replayed ticket or a repeated line is not billed and spends nothing.

All of them deny when the store is down or the budget is spent.

## Store

`UpstashRateLimitStore` talks to Upstash Redis over its REST API with the platform `fetch` (no driver, no socket held between serverless invocations). One Lua script does `INCR`, `EXPIRE … NX` and `PTTL`, so concurrent attempts cannot both see the same count and a counter that lost its lifetime heals itself. There is no in-memory backend: development and CI run an Upstash-compatible emulator from `docker-compose.yml`. Unit tests of use cases use an in-memory double that lives under `__tests__/src/support/`; it is not part of `src/`.

## When something is missing

- **The store fails or times out**: the policy's `onBackendFailure` decides. `deny` refuses the operation (mail, external calls, sign-in, anything that changes what is live); `allow` lets it through unlimited and logs a `warn`, and is a reviewed exception: the policy carries a `// @fail-open <reason>` comment and the module's role must allow it (`ROLES.<role>.rateLimitsMayFailOpen`, `eslint/policy/policy.mjs`). There is no third option and no fallback to local memory.
- **The client address cannot be trusted** (`unresolved-client`): the policy's `onUnresolvedClient` decides, `skip` (another budget still protects the operation) or `deny`. Addresses come from `x-vercel-forwarded-for` or the trusted proxy chain of `x-forwarded-for`, selected by `RATE_LIMIT_CLIENT_ADDRESS_SOURCE`; an address is never guessed. Production refuses to start when neither that variable, `AUTH_TRUSTED_PROXIES` nor Vercel's `VERCEL` says where addresses come from, so per-address budgets are never off by accident (`none` must be written out).
- **A policy or subject is invalid**: always denied, whatever the failure mode says. A broken configuration must not switch protection off.

## Switching it off

`RATE_LIMIT_ENABLED=false` (development only, like `AUTH_ENABLED=false`) makes `getRateLimiter()` return a limiter that counts nothing and allows every attempt; the Upstash and secret settings are then not required, no client address is resolved, and one `warn` (`rate_limit.disabled`) says so per process. Production refuses it at startup.

## Configuration

`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `RATE_LIMIT_SECRET` (at least 32 characters in production) are required in every environment; production also requires `https` for the URL. See `src/lib/config/rate-limit-env-schema.ts`.

## Enforcement

Lint (`architecture/rate-limit-usage` and the policy checks in `eslint/policy/checks-rate-limits.mjs`) requires every public use case to spend a budget or say why not (`@rate-limit none <reason>`), forbids calling the limiter outside use cases, and validates every declared policy. Log lines carry policy ids, counts and coarse reasons only.
