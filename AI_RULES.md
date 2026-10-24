# AI Engineering Rules

These are the canonical engineering rules for AI-assisted development in this repository.

Use this file when the full engineering context is needed in one place, especially when working in a web-based AI editor where copying several files is inconvenient.

## Authority and usage

- These rules are mandatory project conventions, not suggestions.
- Follow these rules for every change unless a more specific rule below explicitly applies.
- When rules overlap, apply the rule belonging to the more specific responsibility.
- When a convention conflicts with a rule, the rule wins.
- A deviation must be recorded as a short decision note and the owning rule updated.
- Architectural dependency violations must fail lint/build checks.
- Prefer referencing the relevant rule when a rule file exists rather than creating duplicate guidance.
- The repository's split rule files remain the canonical organized documentation; this file is the consolidated AI-friendly copy.

---

# 1. Architecture

- Organize business capabilities as modules.
- Dependencies point inward toward domain and application abstractions.
- Business logic never lives in framework entry points.
- Framework-specific code remains at the outer boundary.
- Prefer dependency inversion over direct infrastructure dependencies.
- Domain and application code must not read the clock, randomness, or environment directly; inject them through ports.
- Shared code must be genuinely generic; do not extract module code prematurely.
- Modules are integrated in composition roots: a module's `composition.ts` is the only place that wires another module into it at runtime.
- The module dependency graph is acyclic.
- Architectural dependency violations must fail lint/build checks.
- A deviation from these rules must be recorded as a short decision note and the owning rule updated.

## Dependency direction

Allowed direction:

| From                | May depend on                    |
| ------------------- | -------------------------------- |
| Next.js / Framework | Presentation, Application        |
| Presentation        | Application contracts, Shared UI |
| Infrastructure      | Domain, Application contracts    |
| Application         | Domain, including ports          |
| Domain              | Nothing outside the domain       |

- Ports are defined in the domain and implemented in infrastructure.
- Cross-module access uses the target module's public API (`index.ts`, or `client.ts` from browser code).
- Dependency direction must be enforced by linting wherever practical.

## Layer boundaries

- Domain must not import Next.js, React, Prisma, infrastructure, or presentation.
- Application must not import React, Next.js, infrastructure implementations, or presentation.
- Application depends on domain ports, not infrastructure implementations.
- Infrastructure may depend on domain and application contracts.
- Presentation may depend on application contracts and presentation types.
- Presentation must not import infrastructure.
- Shared UI must not import business modules.
- Modules must not import another module's infrastructure.
- Framework entry points may depend on application and presentation APIs.
- Framework entry points (`src/app`) are the application's composition boundary and may import any module's public API.
- Runtime calls into another module happen only in the module's `composition.ts` and in infrastructure adapters that implement the module's own domain ports.
- Domain and application may `import type` from another module's public API; at runtime they may call only the pure functions the architecture policy lists (`CROSS_MODULE_RUNTIME_ALLOW`).
- Presentation may import another module's browser-safe API (`client.ts`: routes, vocabulary, Server Actions) or its types; another module's server-side parts are handed in by `composition.ts`.
- Repositories and record mappers may import only trusted brand constructors (`to<Name>Id`) from another module.
- A port defined in shared code (`Clock`, `RateLimiter`, `ObjectStore`) may be imported as a type by every layer; its implementation is wired only by composition roots.

## Shared code

- Shared code lives in `src/lib`, `src/components` (`ui` primitives, `layout` primitives, `shared` composites), `src/hooks` and `src/i18n`; it never imports a business module.
- Extract to shared code only when a second module needs the same concept, not because two pieces look alike.
- A mechanism every module needs (audit log, persistence failure mapping, action input parsing) is written once in `src/lib`; each module keeps only its own vocabulary.
- What the shared library already does is imported, not written again. Lint reports a local function or constant named like a `@lib/utils` export (the list is read from the library), a minute, hour or day written as milliseconds (`MS_PER_MINUTE`, `MS_PER_DAY`), and the hand-written form of the common helpers: `.filter(x => x !== null)` (`isDefined`), `[...new Set(x)]` (`unique`), `Math.min(…Math.max(…))` (`clamp`), `s.trim() === ''` (`isBlank`, `trimToNull`), `.filter((_, i) => i !== n)` (`removeAt`), `.map((x, i) => i === n ? v : x)` (`replaceAt`), `Object.fromEntries(Object.entries(o).filter(…))` (`pick`, `omit`), `new URLSearchParams({…})` (`buildQueryString`), and paging arithmetic (`offsetOf`, `pageCountOf` from `@lib/pagination`).
- Remove a shared piece when its last consumer goes.
- Check `src/lib/README.md` and `src/components/README.md` before adding shared code, and update them in the same change.

---

# 2. Module Structure

- Each business capability lives under `modules/<module>`.
- A module may contain `domain`, `application`, `infrastructure`, and `presentation`.
- `domain` contains models, errors, and ports.
- `application` contains commands and queries, the `contracts` they share (inputs, views, constraints), and `services`.
- `application/services` holds what a use case needs that is not the use case itself: parsing input, loading the context, deciding, mapping to views. It keeps commands and queries short and shares a piece between them. A service reaches data only through domain ports; commands and queries call services, a service never imports a command or a query, and a query never imports a command. Lint enforces the direction (`architecture/application-flow`).
- A command or query keeps its own file short: with more than three local helpers (functions beside the class, methods besides `execute`) the helpers are a service in `application/services`, one file per job. Lint enforces it (`architecture/use-case-helpers`).
- `infrastructure` contains implementations of ports and external integrations.
- `presentation` contains actions, DTOs, and module-specific components.
- Server Actions are framework adapters; they live in `presentation/actions` and only call application use cases.
- Module-specific components belong in `presentation/components`.
- Shared UI components belong outside modules.
- A module must not import another module's infrastructure or internal implementation details.
- Cross-module communication must use the other module's public API.
- `composition.ts` is the module's composition root: the only file that knows both use cases and adapters, and the only place another module is wired in.
- `index.ts` exposes the module's intentional server-side public API; `client.ts` exposes the browser-safe part. Nothing else in a module is a barrel file.
- Internal implementation details must not be exported from the module public API; re-export named members, never `export *`.
- A module that refers to another module's aggregate declares its own branded reference id under the same brand name (for example `ProfileId`) instead of importing the owner's. Values cross without mapping, the modules share no types, and no cycle appears.
- Every use case is protected by default; a `public` or `system` use case carries an `@authorization <category> <reason>` tag, and the reviewed list lives in the architecture tests.

---

# 3. Next.js

- Use the App Router exclusively.
- Use Server Components by default.
- Add `"use client"` only when client-side capabilities are required.
- Keep Client Component boundaries as small and deep as practical.
- Pages and layouts compose application capabilities; they contain no business logic.
- Server Components call application queries directly.
- Do not create internal API endpoints for Server Component data fetching.
- Server Actions are framework adapters for mutations.
- Server Actions must call application use cases.
- Server Actions must enforce authentication and authorization independently.
- Validate Server Action input before calling the use case.
- Server Actions return a typed result: success data, or field-level errors plus an optional form-level error code, never localized messages.
- Forms submit through Server Actions unless a real HTTP consumer requires a Route Handler.
- Show pending state during submission, prevent double submission, and preserve user input when validation fails.
- Route Handlers exist only for actual HTTP consumers.
- Use `proxy.ts` only for request-level concerns.
- Do not put business authorization rules in `proxy.ts`.
- Use `loading.tsx` for meaningful route loading states. A page that streams per-request data puts its `loading.tsx` in its OWN segment (or wraps the data in `<Suspense>` inside the page): a client navigation re-renders only the segments below the one that changed, so a boundary in a parent route group cannot catch the page's load and Cache Components reports "uncached data during prerendering or a navigation".
- Use `error.tsx` for unexpected route-level failures; it shows translated generic text, never `error.message`, and renders through the shared `RouteErrorPanel` and `NotFoundPanel`. `global-error.tsx` covers failures of the locale layout.
- Use `not-found.tsx` or `notFound()` for missing resources.
- Use Suspense boundaries for independently streamable UI.
- Use async request APIs such as `params`, `searchParams`, `cookies`, and `headers`.
- Use Next.js navigation primitives instead of raw equivalents where applicable.
- Use route metadata APIs for page metadata, through the builders in `@lib/seo`: localized pages declare canonical and language alternates, untranslated content one canonical URL, and private or single-use-link pages `noindex`.
- `robots.ts`, `sitemap.ts` and `manifest.ts` are the only sources of those files; private areas are excluded in `robots.ts` and marked `noindex`.
- With `cacheComponents`, route segment options such as `dynamic` and `runtime` are rejected (every route runs on Node.js); make a handler per-request with `connection()`.
- Keep Node-only dependencies out of Edge-compatible code.
- Declare runtime requirements explicitly when they matter, except where the framework forbids it.
- `'use server'` appears only in a module's `presentation/actions`, because every such function is a public endpoint. Pages, layouts and route files stay Server Components; the interactive part is a small `'use client'` component they render. Lint enforces both.

---

# 4. React

- Keep components focused on presentation and interaction.
- Keep business logic outside React components.
- A component draws what it is given. A little logic next to the markup is fine (one `useState`, a derived value, a handler); once it does more, the state, effects, derived values and handlers move into a hook (`use-*.ts`) the component calls.
- "A little" is five things: besides calling hooks of its own and returning markup, a component may declare at most five (derived values, handlers, and React's own `useState`, `useEffect`, `useMemo`, `useCallback`). Design-system primitives in `src/components/ui` are exempt. Lint enforces it (`architecture/component-logic`).
- Keep Client Components small and close to the interactive UI.
- Do not move a parent component to the client to support one interactive child.
- Prefer local state; lift state only when multiple components need it.
- Prefer derived values over duplicated state.
- Use refs for mutable values that should not trigger renders or for DOM access.
- Do not use `useEffect` for derived state or normal data fetching.
- Do not introduce client-side data-fetching libraries for data a Server Component can load directly.
- Keep effects for synchronizing with external systems.
- Prefer React's automatic optimization; avoid unnecessary `useMemo` and `useCallback`.
- Use memoization only when it solves a demonstrated performance problem or is required by an API.
- Components must expose accessible names and states.
- Prefer composition over deeply configurable components.
- A form that edits stored data protects unsaved work: it reports to an `UnsavedChangesGuard` (`useReportUnsavedChanges`) or uses `useUnsavedNavigationGuard` with `useBeforeUnloadGuard`. A form with nothing worth keeping (sign-in, a single field) says so with `@unsaved-work none <reason>`; lint checks `react-hook-form` forms in module components.

---

# 5. HTTP and APIs

- HTTP is a delivery mechanism, not an application layer.
- Create Route Handlers only for real HTTP consumers.
- Every request input crossing the HTTP boundary—body, query parameters, headers, and route parameters—must be validated.
- Authenticate requests before protected operations.
- Authorize operations at the application boundary.
- Route Handlers call application use cases or queries.
- Route Handlers contain no business logic.
- Map application `Result` values into HTTP responses at the boundary.
- A failed `Result` becomes a specific HTTP status code, not a generic 500.
- Never expose domain or persistence objects directly; return explicit response DTOs.
- Use consistent HTTP status semantics and a consistent error response shape. A rate-limited `Result` becomes `429` with a `Retry-After` header.
- Do not expose internal exception messages.
- Version public APIs; do not make breaking changes to a published contract.
- Make non-idempotent operations safe to retry where clients may retry.
- HTTP-specific types must not leak into domain or application code.
- Webhooks must validate authenticity before processing payloads.

---

# 6. Validation

- Validate all external input at the system boundary.
- Never trust client-side validation.
- Use Zod as the canonical runtime validation library, in the presentation layer: schemas for requests, forms, Server Action input and search parameters. Domain, application and infrastructure do not import Zod (lint enforces it).
- Below the presentation boundary, data of unknown shape (stored JSON, a driver row, a library's error body) is checked with the guards in `@lib/utils` (`objectOf`, `arrayOf`, …), which check shape only; the domain constructors that run next check the rules.
- Define schemas close to the boundary they validate.
- Parse unknown external data before using it.
- Prefer `safeParse` when validation failure is expected application flow.
- Prefer `parse` when invalid input represents a programmer or invariant violation.
- Do not duplicate identical schemas across layers.
- Do not use TypeScript types as runtime validation.
- Do not pass raw `FormData` beyond the presentation boundary.
- Do not pass raw request JSON into application use cases.
- Validate route parameters and search parameters.
- Validate environment variables at application startup.
- Validate external API responses before mapping them into application types.
- Keep domain invariants in the domain even when Zod validates input.
- Schema naming follows the naming rules.

---

# 7. Error Handling

- Use `neverthrow` for expected application failures.
- Use `Result` for recoverable business and application errors.
- Use `ResultAsync` for asynchronous operations that can fail predictably.
- Never use exceptions for normal business control flow.
- Reserve `throw` for unexpected programmer or system failures that no caller is expected to recover from.
- Domain errors must be explicit typed errors with stable error codes.
- Application errors must describe actionable failure cases.
- Infrastructure errors must be mapped before crossing the infrastructure boundary.
- Do not expose infrastructure error details to users.
- A caller who used an operation too often gets the `rate_limited` kind with `retryAfterSeconds`: it is neither an infrastructure failure nor a permission problem, and waiting is the remedy.
- Presentation layers map error codes to UI or HTTP responses.
- Do not catch an error unless the layer can meaningfully handle or translate it.
- Preserve the original error as a cause when translating unexpected failures.
- Error types describe what happened, not how the error was transported.
- Log an unexpected error once, at the boundary that handles it.

---

# 8. Persistence and Prisma

- Prisma is an infrastructure concern.
- Prisma models must not cross the infrastructure boundary.
- Repositories implement domain ports.
- Application use cases depend on repository abstractions, not Prisma.
- Map Prisma records into domain models.
- Map domain models into Prisma persistence shapes.
- Do not expose Prisma-generated types as application contracts.
- Keep database queries inside repositories or dedicated infrastructure services.
- Transactions belong in application/infrastructure orchestration, not UI code.
- Keep transaction boundaries aligned with application use cases.
- Database constraints must reinforce important domain invariants.
- A compare-and-swap is one `UPDATE … WHERE` statement: `updateAndCount` and a count of 0 means "lost". Never `update()`: the ORM reads the row first and then writes it by key, so a second writer passes the check.
- Inside a transaction, start every query from the transaction handle. A query started from `db` runs on another connection, outside the transaction, its locks and its rollback.
- Do not use database queries as a substitute for domain rules.
- Select only the fields required by the use case.
- Avoid N+1 queries.
- Keep Prisma-specific errors inside infrastructure.
- Schema changes ship as reviewed migrations committed with the change; never edit an applied migration.
- Every query on an owned table (`OWNERSHIP.columns` in `eslint/policy/policy.mjs`; the owned tables are derived from the Prisma contract) is bound to its owner, or says why not with `@owner-scope <kind> <reason>`.
- File bytes live in object storage, never in the database: the database holds ownership and metadata, and its row is the source of truth for whether a file exists.
- Store timestamps in UTC.
- Store money as integer minor units or a decimal type, never floating point.

---

# 9. Caching

- Every cache must have an explicit ownership and invalidation strategy.
- Cache only data whose consistency requirements permit caching.
- Never cache secrets.
- Cache keys must include every value that affects the result, including user or owner identity when the result varies by them.
- Prefer precise cache invalidation over broad invalidation.
- Mutations must invalidate all affected cache entries.
- Do not introduce caching as a workaround for inefficient application logic.
- Do not cache authorization decisions without an explicit identity boundary.
- Document non-obvious cache lifetimes.
- Prefer framework cache primitives at the delivery boundary.
- Keep business logic independent of the caching implementation.

---

# 10. Security

- Treat all client input as untrusted.
- Authenticate every protected operation.
- Authorize every protected use case.
- Never rely on UI visibility for authorization.
- Server Actions must enforce authorization independently.
- Never expose secrets to Client Components.
- Never log credentials, tokens, session secrets, or sensitive personal data.
- Do not trust client-provided user or owner identifiers for authorization.
- Derive authenticated identity from the server-side authentication context.
- Enforce owner isolation at the application/data-access boundary.
- Rate-limit and bound the size of externally reachable inputs, including webhooks and public API routes.
- A rate limit is a policy, declared as plain data in the module's `application/rate-limits.ts` and spent by a use case through the shared `RateLimiter` port; actions, route handlers and adapters never call it. A public use case spends a budget or states why it need not (`@rate-limit none <reason>`).
- A budget counts the authorized actor, the caller's address from trusted request metadata, or a normalised account identifier, never a raw request value; counters hold only keyed hashes.
- A policy states how it fails when the limiter's store is down: operations that send mail, call external systems, change what is live or sign people in deny; allowing is a reviewed exception.
- Counters live in a shared store (Redis over HTTP) in production; the in-memory store exists only as a test double under `__tests__`; development and CI use the Docker Upstash-compatible emulator. Lint and the architecture tests enforce all of this.
- Files are stored through the shared `ObjectStore` port. An object key is derived from trusted ids (owner, asset id), never from a user filename; the database row exists before an upload is authorised; a signed URL is a bearer credential, never logged or stored; a private file is delivered only through a short-lived signed URL.
- Validate webhook authenticity, including signature and replay protection, before processing.
- Protect state-changing requests against CSRF.
- Use secure, `HttpOnly`, `SameSite` cookies for sessions.
- Set standard security headers, including CSP, `X-Content-Type-Options`, `Referrer-Policy`, and frame protections.
- Never render untrusted content as raw HTML; sanitize it first if unavoidable.
- `dangerouslySetInnerHTML` is rejected by lint; if sanitized HTML is unavoidable, disable the rule on that line and say how it is sanitized.
- Prefer allowlists over blocklists for security-sensitive decisions.

---

# 11. Configuration

- Environment variables are infrastructure/configuration concerns.
- Validate environment variables at startup.
- Separate server-only and public configuration: `@lib/config/server` imports `server-only` and holds everything secret; `@lib/config` holds only values safe for the browser.
- A subsystem's variables are required only while that subsystem is on (authentication variables only when `AUTH_ENABLED=true`). Database configuration is always required. Production never allows authentication to be off. Production requires a shared rate-limit store (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) and a secret of at least 32 characters for it. There is no in-memory backend: development and CI use the Docker Upstash-compatible emulator.
- Object storage is off by default (`STORAGE_PROVIDER=none`). Choosing `azure` requires the storage account name and key and its containers; settings for a provider that is not chosen are an error, and production requires `https` for the storage endpoint and the public origin.
- Use `NEXT_PUBLIC_*` only for intentionally public values; secrets must never use this prefix.
- Do not access `process.env` throughout application code.
- Centralize environment access behind typed configuration.
- Do not hard-code environment-specific behavior.
- Fail fast when required configuration is missing.
- Never commit secrets or credentials.

---

# 12. Dependencies

- Use the project's existing package manager exclusively and commit its lockfile.
- Prefer existing dependencies over introducing new ones.
- Every new dependency must have a concrete project requirement.
- Do not introduce a library for functionality already provided by the platform.
- Avoid duplicate libraries solving the same problem.
- Check maintenance status before adding a dependency.
- Development-only packages belong in `devDependencies`.
- Pin or constrain versions according to the lockfile; upgrade deliberately through reviewed changes.
- Remove unused dependencies.
- Run dependency vulnerability audits in CI and act on high-severity findings.
- Dependency additions must not violate architectural boundaries.

---

# 13. TypeScript

- Use strict TypeScript, including `noUncheckedIndexedAccess`.
- Do not use `any`; where genuinely unavoidable, justify it inline.
- Prefer `unknown` for untrusted values and narrow before use.
- Prefer discriminated unions for finite states and variant-specific data.
- Use exhaustive checks so adding a new variant produces compile-time errors where handling is required.
- Prefer `satisfies` for validating object shapes while preserving inference.
- Prefer mapped types and conditional types when they keep related types synchronized.
- Prefer branded types for important identifiers.
- Avoid type assertions when type narrowing is possible.
- Do not use non-null assertions to hide missing invariants.
- Use `import type` for type-only imports.
- Keep domain types independent of framework-generated types.
- Domain value objects are immutable and validate their invariants at construction.
- Prefer inferred types for local implementation details.
- Explicitly type public module APIs.
- Avoid duplicate representations of the same concept; derive types from a single source such as `z.infer`.

---

# 14. Naming

- Files and directories use `kebab-case`, including component files.
- Framework-reserved file names keep their required form: `page.tsx`, `layout.tsx`, `route.ts`, `proxy.ts`.
- Variables, parameters, functions, and methods use `camelCase`.
- Classes, React components, types, interfaces, and enums use `PascalCase`.
- Compile-time constants use `UPPER_SNAKE_CASE`.
- Environment variables use `UPPER_SNAKE_CASE`.
- Zod schemas use `camelCase` with a `Schema` suffix; inferred types drop the suffix.
- Booleans read as predicates: `isActive`, `hasAccess`, `canEdit`.
- Event handler props start with `on`; implementations start with `handle`.
- Custom hooks start with `use`.
- Do not prefix interfaces with `I` or suffix types with `Type`.
- Suffix files by role when the role is not obvious: `.port.ts`, `.repository.ts`, `.schema.ts`, `.action.ts`, `.dto.ts`, `.test.ts`.
- One primary export per file; the file name reflects that export.
- `index.ts` is reserved for a module's public API.
- Commands are imperative, e.g. `CreateOrder`.
- Queries describe the result, e.g. `GetOrderById`.
- Ports are named for the capability, e.g. `OrderRepository`.
- Adapters carry the technology name, e.g. `PrismaOrderRepository`.
- Error types describe what happened, e.g. `OrderNotFoundError`.
- Translation keys are stable, semantic, and dot-separated.
- Avoid generic names such as `helpers`, `misc`, `common`, `manager`, and `data`.
- Avoid abbreviations except widely understood ones such as `id` and `url`.

---

# 15. Code Style

- Formatting is owned by the formatter; do not hand-format or debate style in review.
- Prefer small, single-purpose functions.
- Keep files small: at most 300 code lines (blank lines and comments do not count), and 200 in `application` and in components. Split by responsibility into files named for what they do. Do not split a file whose parts only make sense together (a flat table, one state machine); say so with a `/* eslint-disable max-lines -- <why splitting would hurt> */` … `/* eslint-enable max-lines */` pair around it.
- A lint warning is an error: `npm run lint` fails on any.
- Prefer early returns over deep nesting.
- Prefer `const`; never use `var`.
- Prefer immutable data and non-mutating operations.
- Do not use magic numbers or strings; extract named constants.
- Prefer named exports; use default exports only where the framework requires them.
- Do not use barrel files except for a module's public API.
- Prefer `async`/`await` over promise chains.
- Do not leave dead code, unused exports, or unused parameters. `npm run dead-code` fails on an export nothing references (not even tests or its own file); one that something the compiler cannot see needs (a lookup by name, a framework convention) says so with `/** @keep <reason> */`. Exports only tests use, or only their own file uses, are listed by `npm run dead-code -- --all` and are cleaned up as files are touched.
- Replace boolean parameters that change behavior with separate functions or an options object.
- Functions with more than three parameters take an options object.
- Import order and unused imports are enforced by lint, not convention.

---

# 16. Comments and Documentation

- Comments explain why, not what.
- Do not leave a comment restating the line below it in prose.
- A non-obvious business rule or invariant must be commented at the point it is enforced.
- Reference the owning rule file in a comment when code exists specifically to satisfy an architectural constraint.
- Use JSDoc for exported functions, types, and public module APIs.
- JSDoc on a public API documents behavior and constraints the signature cannot express, not parameter names.
- Do not comment out code; delete it and rely on version control.
- Remove or update a comment when the code it describes changes.
- `TODO` comments must name an owner or a tracked issue.
- Every lint/type-disable directive requires a one-line justification beside it.
- Do not add section-marker comments; split the file or extract a function instead.

---

# 17. Internationalization

- User-facing text must be translatable.
- Do not hard-code user-facing strings in components.
- Translation keys must be stable and semantic.
- Keep translations separate from business logic.
- Do not construct translation keys dynamically when avoidable.
- Pass variables to translations rather than concatenating strings.
- Never use string concatenation for grammatical sentences.
- Format dates, times, numbers, and currencies using locale-aware APIs.
- Store dates as UTC instants; convert to the user's time zone only at presentation.
- Server-rendered translations must use the request locale.
- Client Components must receive only the translation data they require: a subtree declares its namespaces through `I18nProvider`.
- Keep translation resources organized by feature or bounded context: one namespace per module, owned by that module, plus the app shell's `app` namespace for framework entry points.
- One catalog per locale is assembled in `src/i18n/locales/<locale>.ts`; namespaces are never merged into each other.
- A module's message map points only at keys of its own namespace, including its fallback error texts.
- Format dates and numbers through `getAppFormatters` / `useAppFormatters`; never pass a locale to `@lib/utils` from a component, build an `Intl` formatter, or call `toLocale*String` (lint enforces it).
- Every locale has exactly the keys and ICU arguments of the default locale, and no text is empty (`npm run i18n:check`).
- Product names are brands and are not translated.
- Domain errors use stable error codes; presentation maps them to translations.

---

# 18. Accessibility

- Accessibility is part of the definition of done.
- Use semantic HTML before ARIA.
- Every page must declare the correct `lang` attribute and a descriptive title.
- Every form control must have an accessible label.
- Interactive elements must be keyboard accessible.
- Focus must remain predictable after navigation and mutations.
- Error messages must be programmatically associated with their fields.
- After a failed submission, move focus to the first invalid field or an error summary.
- Loading and pending states must communicate meaningful state changes.
- Do not use color as the only way to communicate information.
- Maintain sufficient color contrast.
- Icon-only controls require accessible names.
- Dialogs must manage focus correctly.
- Respect reduced-motion preferences.
- Test critical interactions without a mouse.

---

# 19. Styling

- Use the project's design system as the source of visual truth.
- Prefer shared design tokens over hard-coded visual values.
- Use shared UI primitives before creating new primitives.
- Module components compose shared UI; they do not redefine it.
- Use the design system where it fits: `Button`, `Select`, `Link`, `Table`, `Input`, `Textarea` and `Label` instead of the raw element, and the composite that frames a primitive (a `Table` or `ListPagination` sits in a `DataPanel`). Plain markup is allowed when there is a reason, and the reason is written in the file: `// @ui-plain <name> <reason>` (`name` is the element, or `table` / `list-pagination` for a missing frame). Lint enforces it (`architecture/ui-composition`); `src/components` is the design system itself and is not checked.
- Avoid global styles except for application-wide foundations.
- Keep styling colocated with the component it styles.
- Do not use inline styles for static styling.
- Avoid arbitrary values when an existing design token applies.
- Keep responsive behavior within the component's styling contract.
- Keep dark-mode/theme behavior within the design-system conventions.
- Component variants must be explicit and typed.
- Do not duplicate CSS for visually identical components.
- Styling must meet contrast and motion requirements.

---

# 20. Performance

- Do not optimize without a measured problem, except for the defaults listed here.
- Keep the client bundle small: prefer Server Components and avoid heavy client-only libraries.
- Use dynamic imports for large, rarely used client code.
- Use framework image and font primitives.
- Set explicit dimensions on media to prevent layout shift.
- Stream independent slow UI with Suspense.
- Fetch independent data in parallel, not sequentially.
- Paginate or bound every list-returning query.
- Avoid unbounded in-memory processing of large datasets.
- Do not add a dependency to save a few lines when it costs bundle size.

---

# 21. Observability

- Use structured logging.
- Do not use `console.log` for application observability.
- Log at application/infrastructure boundaries, not inside domain code.
- Never log secrets or sensitive data.
- Preserve useful error causes when translating errors.
- Include request/correlation identifiers where available.
- Record important application failures with sufficient context.
- Instrument external integrations and important persistence operations.
- Audit events are built with `createAuditLog('<module>.audit', LEVEL_BY_EVENT)` from `@lib/logger`; the module owns the event types and their levels, and a new event type does not compile until it has one. Audit events carry ids, counts and codes only, never content or personal data.
- Use log levels consistently:
  - `error` for unexpected failures
  - `warn` for recoverable anomalies
  - `info` for significant events
  - `debug` for diagnostics

---

# 22. Testing

- Test behavior, not implementation details.
- Unit-test domain rules independently.
- Unit-test application use cases with port fakes.
- Test infrastructure adapters against their real contracts.
- Test validation schemas at their boundaries.
- Test Server Actions through their observable behavior.
- Test Client Components through user interaction, querying by role and accessible name.
- Use integration tests for important persistence workflows.
- Use end-to-end tests for critical user journeys.
- Do not mock the system under test.
- Prefer fakes over mocks; assert on outcomes, not call counts.
- Keep tests deterministic: inject clocks and randomness, and never depend on test order or shared state.
- Do not test framework behavior owned by Next.js or Prisma.
- A bug fix ships with a test that fails without the fix.
- Test file naming follows the naming rules.
- Critical interactions must be testable without a mouse.

---

# 23. Project Rules and Documentation Structure

The organized rule files live in `docs/`:

```text
docs/rules/
├── README.md
├── architecture.md
├── boundaries.md
├── modules.md
├── dependencies.md
├── shared.md
├── nextjs.md
├── react.md
├── api.md
├── caching.md
├── validation.md
├── errors.md
├── persistence.md
├── typescript.md
├── naming.md
├── code-style.md
├── comments.md
├── styling.md
├── i18n.md
├── accessibility.md
├── security.md
├── configuration.md
├── performance.md
├── testing.md
└── observability.md

docs/conventions/
├── README.md
├── adding-a-module.md
├── adding-a-use-case.md
├── adding-a-repository.md
├── adding-a-server-action.md
├── adding-a-route-handler.md
├── adding-a-shared-utility.md
├── adding-a-ui-component.md
├── adding-a-rate-limit.md
├── adding-an-environment-variable.md
├── adding-a-database-migration.md
├── adding-a-translation.md
└── fixing-a-bug.md
```

Other documentation:

- `docs/architecture/`: how the larger subsystems work, one document each (currently rate limiting); the shared libraries are described in `src/lib/README.md`.
- `docs/agents/`: review-agent specifications.
- `src/lib/README.md` and `src/components/README.md`: indexes of the shared code.

The split files are organized by responsibility. `AI_RULES.md` exists so an AI assistant can receive the complete engineering rules with one copy/paste; when it differs from `docs/rules/`, the split files win and this file must be corrected.

---

# 24. Conventions

Conventions describe step-by-step procedures for recurring tasks. They link to rules and do not restate them.

When performing a recurring task:

1. Read the relevant rule(s).
2. Read the matching convention in `docs/conventions/`.
3. Follow its numbered checklist. Its `Generator:` line names the `npm run gen -- <command>` that automates the task (`scripts/README.md`), or says there is none; use the generator first.
4. Verify its "Done when" criteria.
5. Update the convention when a rule change alters its procedure.

Use `docs/conventions/README.md` as the index for all available procedures.

---

# 25. Final Change Checklist

Before considering a change complete:

- The implementation follows the applicable architectural and dependency boundaries.
- External input is validated at its boundary.
- Authentication and authorization are enforced where required.
- Business logic remains in the appropriate domain/application layer.
- User-facing text is translatable.
- Accessibility requirements are satisfied.
- Errors are handled through the defined `Result`/error model.
- Persistence changes respect repository and migration boundaries.
- Tests cover the behavior and important failure cases.
- Naming and TypeScript rules are satisfied.
- No unnecessary dependency, cache, abstraction, or client-side code was introduced.
- Relevant lint, type-check, tests, and build checks pass.
- If a recurring procedure was followed, the matching convention was checked.
- If a rule was intentionally changed, the owning rule documentation and affected convention were updated together.
