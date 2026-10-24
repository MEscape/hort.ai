# Core Shared Library (`@lib`)

The shared infrastructure and utilities every module builds on. It is generic (no business owner, no domain concept), it never imports a module, and each part is imported through its own barrel: `@lib/<part>`.

> **AI Note:** Before writing a utility, helper or wrapper, check the exports below. Import from `@lib/<part>` instead of reimplementing them.

**Tests.** The whole layer is held to 100% statement, branch, function and line coverage: `npm run test:coverage` (thresholds in `vitest.config.ts`) fails below it, and `npm run check` runs it. A change to `src/lib` ships with the tests that keep it at 100%.

## Parts

| Part                            | What it is for                                                   |
| ------------------------------- | ---------------------------------------------------------------- |
| [`config`](#lib-config)         | Validated environment variables and the product's identity       |
| [`mail`](#lib-mail)             | Outgoing e-mail: layout, transports, the one delivery error      |
| [`clock`](#lib-clock)           | The time port                                                    |
| [`rate-limit`](#lib-rate-limit) | Budgets for operations anyone can repeat                         |
| [`db`](#lib-db)                 | The Prisma client and persistence failure translators            |
| [`errors`](#lib-errors)         | Typed application errors                                         |
| [`result`](#lib-result)         | The `Result` wrapper and what crosses the Server Action boundary |
| [`actions`](#lib-actions)       | Parsing Server Action input, applying errors to a form           |
| [`logger`](#lib-logger)         | Structured, redacting, server-only logging                       |
| [`seo`](#lib-seo)               | Route metadata builders                                          |
| [`security`](#lib-security)     | Response headers                                                 |
| [`pagination`](#lib-pagination) | Slicing and sorting a list that can grow                         |
| [`fonts`](#lib-fonts)           | Font loading and CSS variables                                   |
| [`utils`](#lib-utils)           | Pure, dependency-free helpers                                    |

<a id="lib-config"></a>

### `@lib/config` (Environment and identity)

Environment variables are validated with Zod, once, when first imported. Do not read `process.env` anywhere else.

- `publicEnv` (`@lib/config`): the validated `NEXT_PUBLIC_*` variables. Safe in any bundle.
- `serverEnv` (`@lib/config/server`, `server-only`): everything, secrets included. Importing it from a Client Component is a build error instead of a runtime failure against the browser's empty `process.env`. A failing start names every variable at fault and the reason, never the value (`parseEnv`).
- `resolveRateLimitSettings(serverEnv)` (`@lib/config/server`): the validated variables as the limiter's settings.
- `APP_IDENTITY` (`@lib/config`): the product's name and its colours, for the places that cannot read CSS variables: `theme-color`, the web app manifest and every e-mail. `colors` are **literal** copies of the `--hortai-color-*` tokens in `globals.css`; a test pins them.
- **Types**: `ServerEnv`, `PublicEnv`.

How it is organised (to add a variable: [`adding-an-environment-variable.md`](../../docs/conventions/adding-an-environment-variable.md)):

- A variable's own shape lives in its domain's Zod schema (`auth-env-schema.ts`, `mail-env-schema.ts`, `rate-limit-env-schema.ts`, `public-env-schema.ts`, the base in `env-schema.ts`). `env-primitives.ts` holds the shared building blocks: `booleanFlag`, `commaSeparatedList`, `integerSetting`, `httpUrl`, `postgresUrl`.
- What must hold **across** variables is a table of `EnvRule`s (`path`, `violated`, `message`; `env-rules.ts`), attached with `schema.superRefine(refineEnv(rules))`: authentication (only while `AUTH_ENABLED=true`), mail (per provider), rate limit (only while `RATE_LIMIT_ENABLED=true`), and the production rules in `env-schema.ts`. Each domain's schema file holds its schema and its rules together; `rate-limit-settings.ts` turns the validated variables into the limiter's settings. To add a rule, add a row to its domain's table.
- What the rules enforce, in short: `DATABASE_URL` is always required; authentication variables only while `AUTH_ENABLED=true`; mail settings as soon as a provider is chosen; production refuses `AUTH_ENABLED=false`, `RATE_LIMIT_ENABLED=false`, `MAIL_PROVIDER=none`, and an `http://` `UPSTASH_REDIS_REST_URL` or `MAIL_API_URL` (both carry a bearer credential); `resend` is refused outside production.

<a id="lib-mail"></a>

### `@lib/mail` (Outgoing e-mail)

How a message leaves, shared by every module that sends one (sign-in, notifications). Modules keep their own wording and their own port; they share the transport and the look.

- `renderEmail(content)`: the shared layout as plain text and HTML. Every dynamic value is escaped; callers pass plain text; an action must link to an `http(s)` address. `subject` defaults to the title; `facts`, `action` (with an optional `note`) and `greeting` are optional. The HTML is semantic and styled inline: no layout tables, none of the retired presentational attributes (`bgcolor`, `align`, `cellpadding`, `width` on a cell), one centred column of at most 560px. The facts are the only table (tabular data). Classic Outlook for Windows draws it full width; every current client draws it as designed.
- `EmailBrand` is everything the layout draws with, resolved to literals: colours, radius, card padding, font stacks. `EMAIL_BRAND` is the one look every message has, from `APP_IDENTITY`.
- `MailTransport`, `OutboundMail`, `MailAttachment`: the delivery contract. `mailDeliveryFailed(cause)` and `MAIL_DELIVERY_FAILED` (`mail.delivery_failed`): its one error. A module that shows the failure maps it to a code of its own and keeps this one as the cause (auth does: `auth.mail_delivery_failed`).
- `getMailTransport()` (`@lib/mail/server`, `server-only`): the process's transport (SMTP or Resend, from `MAIL_*`), or `null` while `MAIL_PROVIDER=none`. Every send gives up after 10 s. SMTP with credentials requires STARTTLS (or `MAIL_SMTP_SECURE=true`), so a password is never sent in the clear. A delivery error names its failure by code (`EENVELOPE 550 RCPT TO`, an HTTP status), never by the recipient or the provider's reply. `resolveMailLocale()` reads the request's language.

<a id="lib-clock"></a>

### `@lib/clock` (Time port)

The `Clock` port every module shares. Domain and application code import it with `import type` and are handed an instance; only `composition.ts` files import `systemClock`.

- **Types**: `Clock` (`now(): Date`).
- `systemClock`: the real clock.

<a id="lib-rate-limit"></a>

### `@lib/rate-limit` (Rate limiting)

Budgets for operations anyone can repeat or that cost something per run. Counters live in Redis, reached over HTTP with the platform `fetch` (Upstash). Development and CI run an Upstash-compatible emulator from `docker-compose.yml`; there is no in-memory backend. How it fits together: [`docs/architecture/rate-limiting.md`](../../docs/architecture/rate-limiting.md); procedure: [`docs/conventions/adding-a-rate-limit.md`](../../docs/conventions/adding-a-rate-limit.md).

Like `Clock`, it is a port every module shares: domain, application and presentation code `import type` from it and are handed an instance; only `composition.ts` files call the runtime functions.

- **Types**: `RateLimiter` (`enforce(request)`, `enforceAll(requests)`: the first refusal wins and later budgets are not counted), `RateLimitPolicy` (`id`, `limit`, `windowSeconds`, `onBackendFailure`, `onUnresolvedClient`), `RateLimitSubject` (`actor`, `client`, `identifier`, `global`), `RateLimitFailure` (a `rate_limited` or an `infrastructure` error), `ClientAddressProvider` / `ClientSubject`, `RateLimitStore`.
- `getRateLimiter()`: the application's limiter, built on the first `enforce` from validated configuration (with `RATE_LIMIT_ENABLED=false`, development only, a limiter that counts nothing and allows everything); a build failure refuses the attempt instead of throwing.
- `getClientAddressProvider(() => headers())`: who is calling by network address, from `x-vercel-forwarded-for` or the trusted-proxy chain of `x-forwarded-for`; an address that cannot be trusted is `unresolved-client`, never a guess.
- `createRateLimiter(deps)`: the limiter over any `RateLimitStore`; tests pass a store they control (`createTestRateLimiter` in `__tests__/src/support/rate-limiting.ts`, backed by an in-memory double that lives only in the tests). `UpstashRateLimitStore` is the only store the application uses (one `EVAL` per attempt).
- `policyProblem(policy)`, `buildBucketKey(policyId, subject, secret)`: the validator behind the policy checks, and the keyed hash every counter is stored under.

<a id="lib-db"></a>

### `@lib/db` (Database access)

- `db`: the singleton Prisma Postgres client (`ReturnType<typeof postgres<Contract>>`); every query is logged at `debug` as parameterised SQL and timing, never with bound values.
- `disconnectDb(): Promise<void>`: for workers, scripts and tests.
- `createPersistenceFailures({ module, code, subject })`: a repository's failure translators, and the one place Prisma and driver errors are classified:
  - `infraOnly(operation)` for reads and idempotent deletes;
  - `orConflict(operation, onConflict)` for writes that can violate a unique or exclusion constraint;
  - `requireRow(onNotFound)` for single-row writes, which resolve to `null` on a miss.

  Anything else thrown is an infrastructure failure: logged once with the operation and the database's `sqlState`, `constraint` and `table` (never its `detail`, which can quote a row), the thrown error kept as `cause`, a generic message for the user. The driver error is looked for along the cause chain, a few levels deep. Foreign-key, not-null and check violations are deliberately not conflicts.

- `conflictConstraint(thrown)`: the name of the constraint a conflicting write ran into (`undefined` when the driver names none). Tell two conflicts apart by it, never by the message.
- `retryTransient(transaction)`: runs a whole transaction again, up to three attempts, when the database aborted it as a deadlock or serialization failure (`40P01`, `40001`); anything else, a conflict included, is thrown at once. The function passed in must be the transaction itself, reads included, so a retry never acts on what the first attempt read.
- `toJsonValue(value)`: plain JSON for a write to a JSON column (`Date` becomes its ISO text, `undefined` members are dropped); throws `JsonStringifyError` for a `bigint` or a cycle.
- `rollbackWith(refusal)` / `rollbackable(run)`: end a transaction on purpose when a refusal is found after something was written, and get the refusal back as a value (`{ kind: 'rolled-back', refusal }`); anything else that throws passes through. Infrastructure may not `throw`, so a repository that must undo its own earlier writes uses this.
- Importing `@lib/db` installs the `temporal-polyfill` global when the runtime has no native `Temporal`. Prisma 8's `timestamptz` codec and `now()` defaults need it; Node 24 (`.nvmrc`) lacks it, Node 26 has it. Any code that reads or writes through Prisma must reach the client through `@lib/db`.
- `instantToDate(instant): Date` converts a Prisma 8 read; `dateToInstant(date)` converts a write (a `Temporal.Instant`, or ISO-8601 text where there is no global `Temporal`). `InstantRecord` is the shape the read side needs.

<a id="lib-errors"></a>

### `@lib/errors` (Typed application errors)

- **Types**: `AppError` (a union of eight kinds: validation, not found, conflict, unauthorized, forbidden, rate limited, infrastructure, unexpected), `AppErrorKind` and one interface per kind.
- **Factories**: `validationError(code, message, fieldErrors)`, `notFoundError`, `conflictError`, `unauthorizedError`, `forbiddenError`, `rateLimitedError(code, message, retryAfterSeconds)` (rounded up, at least 1), `infrastructureError(code, message, cause?)`, `unexpectedError(code, message, cause?)`. The message is safe to show; the diagnostic detail goes in `cause`.
- `matchAppError(error, handlers)`: one handler per kind, exhaustive at compile time.
- **HTTP**: `httpStatusForError(error)`, `httpHeadersForError(error)` (`Retry-After` for a rate-limited error), `toErrorResponseBody(error)` (never the `cause`).
- `FieldErrorBag`: collects field problems in one pass: `add(path, code)`, `expect(isOk, path, code)` (records unless `isOk`, returns it), `hasErrors`, `toError()`. A path may be named like a prototype member (`constructor`).
- `ROOT_FIELD` (`'_form'`): the key for a problem that belongs to no field. `fieldPath(...segments)`: a typed dotted path for `react-hook-form`. `NestedKeyOf<T>`: every dotted path of an object type.
- `escalate(error): never` (`@lib/errors/escalate`, `server-only`): logs and throws to the nearest `error.tsx`. Not in the barrel, which Client Components import.

<a id="lib-result"></a>

### `@lib/result` (Result pattern)

A wrapper around `neverthrow`, so call sites import from here and never from the package.

- **Types**: `AppResult<T, E>`, `AppResultAsync<T, E>`, `ActionResult<T>`, `SerializedActionError`.
- **Constructors**: `ok`, `err`, `okAsync`, `errAsync`, `fromThrowable(fn, onError)`, `fromThrowableAsync(fn, onError)` (also catches a synchronous throw), `combine`, `combineAsync`.
- `toActionResult(result)`: the plain object a Server Action returns; code and message, `fieldErrors` or `retryAfterSeconds` where they apply, never a `cause`.
- `createIdParser({ isValid, brand, mapError })`: a module's branded id parser for request values. `parseValidIds(raw, parse, limit)`: those that parse, each once, at most `limit`.

<a id="lib-actions"></a>

### `@lib/actions` (Server Actions)

- `createActionInputParser(code)`: returns `(schema, input) => AppResult<T, ValidationAppError>`; `code` is the module's "invalid input" code. Problems are reported by dotted field path, with no input value in them.
- `applyActionError(error, setError, codeFields?)`: puts field errors on their inputs (focusing the first) and returns the form-level code to show, or `null`.

<a id="lib-logger"></a>

### `@lib/logger` (Observability)

Structured, server-only logging. Do not use `console.log`. Client Components never log through it.

- `logger.debug|info|warn(message, context?)`, `logger.error(message, error, context?)`, `logger.withContext(base)`: one JSON line each, filtered by `LOG_LEVEL`. Always pass context objects (`logger.error('msg', err, { siteId })`).
- A context key that **contains** `password`, `token`, `secret`, `api-key`, `authorization`, `cookie` or a similar word is written as `[REDACTED]`, at any depth and in any casing (`accessToken`, `Set-Cookie`). Nesting past 8 levels is cut off, a `bigint` is written as text, and a context that cannot be serialized costs only the context: a log call never throws.
- `createAuditLog(module, levels)`: the one implementation of every module's audit port. The module owns its event types and levels; this writes one structured line per event and never throws.

<a id="lib-seo"></a>

### `@lib/seo` (Route metadata)

Pages never assemble canonical URLs or robots directives themselves.

- `buildLocalizedMetadata({ locale, pathname, title, description })`: translated platform pages: canonical, hreflang alternates (every locale, and `x-default` for the default one, in lower case as the HTML specification and Google write it), Open Graph with locale.
- `buildContentMetadata({ pathname, title, description, siteName })`: untranslated content (a published site's pages): one canonical URL in the default locale, the site as the brand.
- `buildPrivateMetadata(title)`: pages behind sign-in or single-use emailed links: title and `noindex` only.
- `toLocalizedPath(locale, pathname)`: `('de', '/')` → `/de`.

<a id="lib-security"></a>

### `@lib/security` (Response headers)

What every response carries; `next.config.ts` applies it to all routes.

- `securityHeaders({ isProduction })`: CSP without script rules (`object-src`, `base-uri`, `form-action`, `frame-ancestors`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production. A script-src policy needs a per-request nonce and belongs in `proxy.ts`.

<a id="lib-pagination"></a>

### `@lib/pagination` (Paging a list)

How every list that can grow is sliced. The address carries the state (`?page=3&pageSize=25&sort=-createdAt`), so a page can be shared and works without script.

- `resolvePageRequest({ page, pageSize }, limits?)`: untrusted query text to a `PageRequest`. Never throws; junk falls back to page 1 and the default size, and the size never exceeds `maxPageSize` (default 25 / 100).
- `offsetOf(request)`, `pageCountOf(total, pageSize)`, `toPage(items, total, request)`, `clampToLastPage(request, total)`: the arithmetic and the `Page<T>` a screen draws from.
- `resolveSort(raw, allowedFields, fallback)` / `formatSort(spec)`: `field` or `-field` against an allowlist, so a query value never becomes a column name.
- `loadClampedPage(request, load)`: loads the page asked for; a page past the end answers the last one. Every paged use case wraps its store read in it.
- `PAGE_SIZE_OPTIONS`: the sizes a user can choose.
- Pair with `<Pagination>` (`@components/shared/pagination`). Repositories take a `PageRequest` and return the items plus a `total`; filtering, ordering and counting happen in the store, never in memory over an unbounded read.

<a id="lib-fonts"></a>

### `@lib/fonts` (Typography)

- `fontFredoka`, `fontNunito`, `fontAtkinson` (`NextFontWithVariable`, `next/font/local`): the loaders, reading the self-hosted files in `public/fonts` (see its README), for `--font-fredoka` (headings), `--font-nunito` (body) and `--font-atkinson` (the `data-font="readable"` variant); `globals.css` points the design tokens at these variables.
- `fontVariables`: the combined class string for the root layout.

<a id="lib-utils"></a>

### `@lib/utils` (Pure utilities)

Zero-dependency (except `cn`, in its own file), side-effect-free helpers, one file per concern, all exported from `@lib/utils`. Every function is documented where it is defined: behaviour, edge cases, what it throws, an example. Untrusted text, paths and keys are treated as untrusted: nothing here reaches the prototype chain, and the text helpers run in linear time.

| File         | Exports                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `array`      | `isDefined`, `groupBy`, `keyBy`, `unique`, `range`, `literalGuard`, `insertItem`, `replaceAt`, `removeAt` (copies, never mutations)                                                                                            |
| `assert`     | `assertNever` (exhaustiveness), `invariant` (a condition that must hold; never for input)                                                                                                                                      |
| `async`      | `sleep`, `withTimeout`, `TimeoutError`                                                                                                                                                                                         |
| `brand`      | `Brand<T, B>`: a nominal type                                                                                                                                                                                                  |
| `cn`         | `cn`: class names with Tailwind conflict resolution                                                                                                                                                                            |
| `date`       | `formatDate`, `formatDateTime`, `formatRelativeTime`, `addDays`, `DateInput`, `MS_PER_DAY`, `MS_PER_MINUTE`, `SECONDS_PER_HOUR`, `SECONDS_PER_MINUTE`. Components use `getAppFormatters` / `useAppFormatters` instead          |
| `function`   | `debounce`, `once` (a throwing call is not cached), `identity`, `noop`                                                                                                                                                         |
| `json`       | `parseJson` (`JsonParseError`), `stringifyJson` (`JsonStringifyError`), `stableStringify` (sorted keys; ids derived from it are stored, so pin it with tests), `JsonValue`, `JsonPrimitive`                                    |
| `json-value` | `isJsonValue`, `isJsonRecord` (both take a `maxDepth`), `jsonWeight`: is it JSON, and how big                                                                                                                                  |
| `number`     | `clamp`, `formatNumber`, `formatPercent`, `formatMoney` (integer minor units only), `formatBytes`                                                                                                                              |
| `object`     | `isPlainObject`, `hasOwnKey`, `pick`, `omit`, `deepEqual`, `deepMerge` (a `__proto__` key stays data), `definedKeys`, `changedKeys`                                                                                            |
| `path`       | `getPath` (own properties only), `setPath`, `hasUnsafePathSegment`, `isUnsafePathSegment`, `normalizePath`, `pathSegments`                                                                                                     |
| `shape`      | `Guard<T>`, `isString`, `isBoolean`, `isFiniteNumber`, `isInteger`, `arrayOf`, `nullable`, `optional`, `oneOf`, `objectOf`: shape checks for data read back from storage (Zod is for the presentation boundary)                |
| `string`     | `slugify`, `truncate`, `escapeHtml`, `stripHtml` (a preview helper, **not** a sanitizer), `isBlank`, `trimToNull`                                                                                                              |
| `tree`       | `countNodes`, `mapTree`, `GetChildren`, `WithChildren`, `TreeShape`; forests: `flattenForest`, `locateInForest`, `findPathInForest`, `updateForest`, `removeFromForest` (structural sharing). Recursive: bound untrusted depth |
| `url`        | `isValidUrl` (protocol allowlist), `isRelativePath` (open-redirect guard, judged as a browser resolves it), `stripTrailingSlash`, `joinPath`, `buildQueryString`                                                               |

Adding one: [`adding-a-shared-utility.md`](../../docs/conventions/adding-a-shared-utility.md). A helper with no user is removed, not kept "for later".
