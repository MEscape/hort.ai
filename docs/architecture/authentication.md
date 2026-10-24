# Authentication and access control

Who is signed in, and whether they may do what a use case asks. Owning rules: [`security.md`](../rules/security.md), [`boundaries.md`](../rules/boundaries.md). Code: [`src/modules/auth`](../../src/modules/auth) and, for the trail it feeds, [`src/modules/audit`](../../src/modules/audit). The presentation layer supplies parent authentication forms and Server Actions; routing stays in the App Router.

## Identity model (MVP assumptions)

| Concept               | What it is                                                                                         | Where it lives                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Parent (actor)**    | The only authenticated identity: an e-mail and password account, confirmed by e-mail               | `auth` module (`Actor`, role `parent`)                             |
| **Child profile**     | Data a parent owns: name, learning settings. Not an account, has no credentials and no permissions | a future `learner` module (not built)                              |
| **Learning progress** | Belongs to a child profile, therefore to that profile's parent                                     | a future learning module (not built)                               |
| **Tenant**            | One configured tenant (`default`), the same for every account                                      | `AUTH_DEFAULT_TENANT_ID`, stamped on every `Actor` by the provider |

The product requirements do not say whether a child ever signs in with credentials of its own. Nothing here invents that policy: a child is a profile of a parent, and the parent's session is the only session. The model stays adaptable:

- A child credential or "kid mode" would add an identity next to the parent's (a second role, or a profile-scoped session). It would not change `decide`, `ResourceScope` or the audit events.
- The **active learner** (which child the parent is working with) is application state of the learner module, derived from a profile id the client sends. It is never an authority: the profile is loaded, its stored `ownerId` is compared with `actor.id` by `requireOnResource`, and only then is it used.

### Responsibilities

- **auth** establishes identity and sessions and answers "may this parent do this to this resource". It does not create, store or validate child profiles, and logging in never creates one.
- **account/parent module (when needed)** owns account-level capabilities beyond credentials (display name, settings). It may orchestrate "an authenticated parent creates a child profile" by calling the learner module's use case.
- **learner module** owns the profile's rules (name, age, preferences), its lifecycle and its persistence. Every profile row stores `ownerId` (the guardian's `ActorId`) and `tenantId`. Its use cases call `authorization.requireInTenant('learner.create')` first (the returned actor is the owner to store), and `requireOnResource('learner.read' | 'learner.update' | 'learner.delete', { tenantId, ownerId })` on the loaded record.
- **learning/progress module** reaches progress through the child profile, so the same ownership check applies; it never trusts a profile id as proof of access.

## Authorization

`decide(actor, permission, scope?)` is a pure domain function, fail-closed, in this order:

1. **Tenant**: the resource's stored `tenantId` must equal the actor's.
2. **Owner**: the resource's stored `ownerId` must equal the actor's id. A parent holds `learner.*` for their own children only.
3. **Permission**: any of the actor's roles grants it (`parent` grants every `learner.*` permission; the table is code, not data).

`AuthorizationService` exposes two calls on purpose: `requireInTenant(permission)` (create, list your own) and `requireOnResource(permission, scope)` (a loaded resource). A caller cannot drop the scope by passing `undefined`. Every denial is the one `auth.permission_denied` error; the precise reason (`tenant_mismatch`, `owner_mismatch`, `permission_missing`) goes only to the audit log, because telling them apart would disclose that a resource exists for someone else.

## Tenant configuration

`AUTH_DEFAULT_TENANT_ID` (`src/lib/config/auth-env-schema.ts`, default `default`) is the only source of the tenant. It is validated at startup (a slug of at most 64 characters) and again by the domain (`createTenantId`) when the composition root builds the provider. The actor's tenant is set by `BetterAuthCurrentActorProvider` / `DevCurrentActorProvider` from that value; nothing in a request (header, cookie, query, form field) is read to choose or override it. To run another tenant, change the variable; no code changes. There is no tenant registry or tenant table: add one only when a second tenant exists. A tenant on its own authorizes nothing: it is the first comparison of `decide`, never a grant.

## Flows and the module surface

Use cases (in `application/commands`, called by the validated Server Actions in presentation/actions): `SignIn`, `SignUp`, `SignOut`, `RequestPasswordReset`, `ResetPassword`, `AdmitLinkRequest`. Query: `GetCurrentActor`. All unauthenticated flows validate first, then spend rate-limit budgets (client address first, then the normalised account), then call the provider; all fail closed when the limiter's store is down.

- Sign-up confirms the address by mail before any sign-in works. A repeated sign-up answers like a first one and mails the owner instead, so sign-up cannot enumerate accounts. Sign-in answers one `auth.invalid_credentials` for an unknown account and a wrong password.
- Sessions are server-side rows (cookie cache off), so sign-out and password reset revoke at once. A hard ceiling (`AUTH_SESSION_MAX_LIFETIME_SECONDS`) ends a session however active it is. The actor provider treats a session of an unconfirmed address as signed out.
- The provider's HTTP surface is closed except the two emailed links (`GET /api/auth/verify-email`, `GET /api/auth/reset-password/<token>`), served by `src/app/api/auth/[...all]/route.ts` after a rate-limit budget is spent.
- With `AUTH_ENABLED=false` (development, loopback only) every request is one fixed parent of the default tenant. Authorization still runs for it.

## Audit integration

Only the audit module's domain, application and infrastructure layers are used. `auth` wraps its own audit port with `withAuditTrail(log, { source: 'auth', levels, policy })` in `composition.ts`: every event is written as a structured log line and, according to `TRAIL_BY_EVENT`, as a durable `AuditEntry`.

| Event                                     | Source                           | Trail actor |
| ----------------------------------------- | -------------------------------- | ----------- |
| `authentication.account_created`          | provider `user.create` hook      | member      |
| `authentication.session_created`          | provider `session.create` hook   | member      |
| `authentication.session_revoked`          | provider `session.delete` hook   | member      |
| `authentication.sign_in_failed`           | provider after-hook (`/sign-in`) | visitor     |
| `authentication.password_reset_completed` | provider `onPasswordReset`       | member      |
| `authorization.denied`                    | `AuthorizationService`           | member      |

- **Content**: ids, error codes and enum values only. No address, name, password, token, cookie or IP is ever an event field, and the trail keeps only plain values. A failed sign-in carries our error code, not the address that was tried. Child details are never recorded.
- **Mechanism**: in-process, fire and forget. No outbox, broker or transaction. The authentication tables live in a separate database from the trail, so a shared transaction is not available anyway.
- **Failure policy**: best effort. A write that fails is logged once by the store and never reaches the caller; the log line is written first, so operations still see the event. A write in flight when the process stops is lost (`shortcut:` in `AuditTrailRecorder`). If the trail must become complete (an auditor requirement), write entries in the same transaction as the change; that needs a decision on the database layout first.
- **Duplicates**: each event is a fact about one occurrence (a session, a denial). Retried operations that really repeat are separate facts, so entries are not deduplicated.
- **Retention**: `PruneAuditTrail` deletes entries older than `AUDIT_RETENTION_DAYS` (default 365). `startAuditRetention` schedules it daily but nothing calls it yet: there is no `instrumentation.ts`. Wire it when the server starts, or entries are kept indefinitely.

## Login interface and frontend contracts

- Call the use cases through Server Actions in `presentation/actions` (validate with Zod there; `CREDENTIAL_LIMITS` and `EMAIL_PATTERN` come from the module's contracts). Map `AUTH_ERROR_CODES` and `AUTH_VALIDATION_CODES` to messages; every code the module emits is in `AuthCode`.
- Pages to serve: `authRoutes.signIn()`, `signUp()`, `forgotPassword()`, `resetPassword()` (receives `?token=` or `?error=`), `emailVerified()` (receives `?error=` on failure). Mail links already point at them.
- Parent registration is one step (`SignUp`) followed by "check your inbox"; the child-profile steps of the mockups (name and age, character, voice, permissions) belong to the learner module and run after the parent is signed in.
- A parent who is not signed in gets `auth.unauthenticated` from `GetCurrentActor`; a page uses it to redirect to sign-in, but the use case behind every protected action authorizes again.
- Show the same message for `auth.invalid_credentials` whether the address exists or not, and do not reveal rate-limit counters; `auth.rate_limited` carries `retryAfterSeconds`.

## Known gaps and decisions needed

- **Child credentials**: undecided (see above). Not built.
- **Parental consent and age handling** (GDPR-K): out of scope here; sign-up confirms the e-mail address only.
- **Learner module and its tables**: not built; the `learner.*` permissions and the ownership check are ready for it.
- **E-mail changes, account deletion, MFA, social login**: not built, as requested.
- **Generators**: `npm run gen -- module` produces tenant-scoped entities whose `scopeOf` returns `{ tenantId }` only. Against this contract that no longer compiles on purpose: in a one-tenant system a tenant-only scope would let any parent reach any other's data. A generated module needs its entity to carry `ownerId` and `scopeOf` to return it.

## Presentation implementation

- **Routes:** `/[locale]/welcome`, `sign-in`, `sign-up`, `forgot-password`, `reset-password`, `email-verified`, and the protected `home` confirmation. `src/proxy.ts` negotiates the locale for bare paths (including email callbacks); the locale index redirects to welcome. The nonoptional catch-all handles unmatched paths. Private and emailed-link pages use noindex metadata.
- **Boundaries:** pages compose the module's public API. Server Actions parse Zod schemas and call the existing application commands. Forms use React Hook Form; state, actions and navigation live in presentation hooks. `client.ts` exposes browser-safe routes and sign-out; catalogs are exported through the server public API as required by module policy. No audit presentation code is introduced.
- **Identity:** registration asks for the parent's display name because the existing backend requires it. It does not create a child. Home confirms that the parent is signed in; learner setup, permissions, Alexa, characters, learning and progress remain separate future capabilities.
- **Tenant:** the UI sends no tenant or role. Unknown input fields are discarded by the action schemas; the configured server tenant remains authoritative.
- **Navigation and sessions:** only the sign-in action resolves untrusted `returnTo` to a same-origin path (default `/home`). Sign-in and sign-out revalidate the root layout after success. Session reads stay behind Suspense and are never cached across requests. The page guard redirects only authentication failures; infrastructure failures reach translated error boundaries.
- **Feedback:** sign-up and recovery confirmation text does not disclose whether an address is registered. Password advice is browser-local and advisory; the backend's length policy remains authoritative. A verification landing message is informational and cannot grant a session; the provider still verifies email before sign-in. Repeated/malformed error parameters show failure.
- **Interaction:** pending submissions disable their fields and primary action. Field errors are associated with inputs; invalid submission focuses the first field, form-level refusals focus the alert, and replacement success panels take heading focus. Password visibility uses an accessible pressed-state toggle. Recovery offers a 60-second resend delay in addition to server rate limiting. Inputs remain out of URLs and browser storage.
- **Visual system:** token-styled shadcn primitives, self-hosted fonts, Lumi the owl's five moods and a warm-paper SVG landscape. German and English catalogs match. Existing OS reduced-motion and `data-motion="calm"` styles stop ambient motion. Locale-dependent server navigation and welcome content stream behind Suspense; the logo has a matching static fallback. Shared UI is indexed in `src/components/README.md`; the identity and asset pipeline are documented in [branding.md](branding.md).
- **Terms:** approved terms and a consent-storage contract have not been provided. The unfinished checkbox and broken `/terms` link were removed; registration does not claim to collect or record legal acceptance. Add approved content and the appropriate persistence contract together when specified.
- **Migration cleanup:** the temporary implementation and mockups are removed after validation. Active code and editable branding sources live in the main workspace. Unused framework-helper scaffolding from the migration was removed; `requireSignedIn` owns the live authentication navigation guard.

### Issue tracking

This implementation contributes parent authentication, authorization primitives, audit integration and the account interface to [#9](https://github.com/MEscape/hort.ai/issues/9). The ticket also requires teacher roles, class isolation and child-profile creation/selection. Those capabilities remain outside this implementation; reference the ticket without closing it.

### Presentation verification

Tests under `__tests__/src/modules/auth/presentation` cover schemas and bounds, safe return paths, error-map completeness in both languages, password advice, email suggestions, Server Action validation and result mapping, protected-page denial, form success and refusal, pending controls, confirmation focus, resend timing and sign-out failure. Existing application, domain and infrastructure suites remain the source of backend security and audit guarantees.
